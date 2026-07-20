/**
 * @jest-environment node
 */

/**
 * Test de integración de extremo a extremo para invertirEnEtapaAction
 * (app/actions/inversion-bifasica.ts) — la vía segura, con movimiento de
 * dinero real, para invertir en un proyecto bifásico. Reemplaza a
 * registrarInversion/aprobarInversion (lib/firebase/proyectos-bifasicos.ts,
 * removidas: SDK cliente, sin pago, confiaban en el uid del cliente).
 *
 * Requiere el emulador de Firestore + Auth: `npm run test:emulator`.
 */

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';
import { doc, setDoc, getDoc, collection, query, where, getDocs, terminate } from 'firebase/firestore';
import { invertirEnEtapaAction } from '@/app/actions/inversion-bifasica';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Este test requiere los emuladores de Firestore Y Auth. Usa `npm run test:emulator`.');
}

async function crearUsuarioDeAuth(email: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, 'clave-de-prueba-verificacion-123');
  const idToken = await cred.user.getIdToken();
  return { uid: cred.user.uid, idToken };
}

async function crearPerfilUsuario(uid: string, saldo: number) {
  await setDoc(doc(db, 'usuarios', uid), { saldo });
}

async function leerSaldo(uid: string): Promise<number | undefined> {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  return snap.data()?.saldo;
}

function etapaBase(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    montoObjetivo: 100000,
    montoRecaudado: 0,
    numeroSociosObjetivo: 10,
    numeroSociosActuales: 0,
    cubos: { totales: 100, vendidos: 0, disponibles: 100, precioPorCubo: 1000 },
    duracionMeses: 12,
    completada: false,
    activa: true,
    ...overrides,
  };
}

async function seedProyectoBifasico(
  proyectoId: string,
  gestorId: string,
  overrides: Partial<Record<string, unknown>> = {}
) {
  await setDoc(doc(db, 'productos', proyectoId), {
    nombre: 'Proyecto bifásico de prueba',
    creador: { id: gestorId },
    modeloBifasico: true,
    etapas: {
      tierra: etapaBase(),
      construccion: etapaBase({ activa: false }),
    },
    inversores: [],
    ...overrides,
  });
}

describe('invertirEnEtapaAction (modelo bifásico, extremo a extremo, emulador)', () => {
  afterAll(async () => {
    await terminate(db);
  });

  test('inversión exitosa: debita al inversor, acredita al gestor, actualiza etapa y crea socio + inversión confirmada', async () => {
    const proyectoId = `proj-bif-${Date.now()}`;
    const gestor = await crearUsuarioDeAuth(`gestor-bif-${Date.now()}@test.com`);
    const inversor = await crearUsuarioDeAuth(`inversor-bif-${Date.now()}@test.com`);

    await crearPerfilUsuario(gestor.uid, 0);
    await crearPerfilUsuario(inversor.uid, 50000);
    await seedProyectoBifasico(proyectoId, gestor.uid);

    const resultado = await invertirEnEtapaAction(inversor.idToken, proyectoId, 'tierra', 10);

    expect(resultado.ok).toBe(true);
    expect(resultado.montoTotal).toBe(10000); // 10 cubos * 1000/cubo
    expect(resultado.cubosComprados).toBe(10);

    expect(await leerSaldo(inversor.uid)).toBe(40000); // 50000 - 10000

    const gestorSnap = await getDoc(doc(db, 'usuarios', gestor.uid));
    const saldoRecaudado = gestorSnap.data()?.saldoRecaudado || [];
    expect(saldoRecaudado.find((s: any) => s.idProducto === proyectoId)?.monto).toBe(10000);

    const proyectoSnap = await getDoc(doc(db, 'productos', proyectoId));
    const etapaTierra = proyectoSnap.data()?.etapas.tierra;
    expect(etapaTierra.montoRecaudado).toBe(10000);
    expect(etapaTierra.cubos.vendidos).toBe(10);
    expect(etapaTierra.cubos.disponibles).toBe(90);
    expect(etapaTierra.numeroSociosActuales).toBe(1);

    const socioSnap = await getDoc(doc(db, 'socios', `${proyectoId}_${inversor.uid}`));
    expect(socioSnap.exists()).toBe(true);
    expect(socioSnap.data()?.activo).toBe(true);
    expect(socioSnap.data()?.valorAportado).toBe(10000);
    expect(socioSnap.data()?.tipoSocio).toBe('tierra');

    const inversionesQuery = query(collection(db, 'inversiones'), where('proyectoId', '==', proyectoId));
    const inversionesSnap = await getDocs(inversionesQuery);
    expect(inversionesSnap.size).toBe(1);
    expect(inversionesSnap.docs[0].data().confirmada).toBe(true);
    expect(inversionesSnap.docs[0].data().montoInvertido).toBe(10000);
  });

  test('segunda inversión del mismo usuario acumula el socio en vez de duplicarlo', async () => {
    const proyectoId = `proj-bif-${Date.now()}`;
    const gestor = await crearUsuarioDeAuth(`gestor-bif2-${Date.now()}@test.com`);
    const inversor = await crearUsuarioDeAuth(`inversor-bif2-${Date.now()}@test.com`);

    await crearPerfilUsuario(gestor.uid, 0);
    await crearPerfilUsuario(inversor.uid, 50000);
    await seedProyectoBifasico(proyectoId, gestor.uid);

    await invertirEnEtapaAction(inversor.idToken, proyectoId, 'tierra', 10);
    const segundo = await invertirEnEtapaAction(inversor.idToken, proyectoId, 'tierra', 5);
    expect(segundo.ok).toBe(true);

    const proyectoSnap = await getDoc(doc(db, 'productos', proyectoId));
    // El socio ya existía: numeroSociosActuales no debe subir a 2.
    expect(proyectoSnap.data()?.etapas.tierra.numeroSociosActuales).toBe(1);
    expect(proyectoSnap.data()?.etapas.tierra.cubos.vendidos).toBe(15);

    const socioSnap = await getDoc(doc(db, 'socios', `${proyectoId}_${inversor.uid}`));
    expect(socioSnap.data()?.valorAportado).toBe(15000);
    expect(socioSnap.data()?.porcentajePropiedad).toBe(15);

    const inversionesQuery = query(collection(db, 'inversiones'), where('proyectoId', '==', proyectoId));
    const inversionesSnap = await getDocs(inversionesQuery);
    expect(inversionesSnap.size).toBe(2); // dos registros históricos, un solo socio
  });

  test('si el gestor invierte en su propio proyecto, el saldo neto se acumula correctamente', async () => {
    const proyectoId = `proj-bif-${Date.now()}`;
    const gestor = await crearUsuarioDeAuth(`gestor-bif3-${Date.now()}@test.com`);
    await crearPerfilUsuario(gestor.uid, 20000);
    await seedProyectoBifasico(proyectoId, gestor.uid);

    const resultado = await invertirEnEtapaAction(gestor.idToken, proyectoId, 'tierra', 5);
    expect(resultado.ok).toBe(true);

    // Paga 5000 (débito) pero también se acredita a sí mismo 5000 en
    // saldoRecaudado — el saldo disponible baja, lo recaudado sigue vivo.
    expect(await leerSaldo(gestor.uid)).toBe(15000);
    const gestorSnap = await getDoc(doc(db, 'usuarios', gestor.uid));
    const saldoRecaudado = gestorSnap.data()?.saldoRecaudado || [];
    expect(saldoRecaudado.find((s: any) => s.idProducto === proyectoId)?.monto).toBe(5000);
  });

  test('rechaza si no hay suficientes cubos disponibles', async () => {
    const proyectoId = `proj-bif-${Date.now()}`;
    const gestor = await crearUsuarioDeAuth(`gestor-bif4-${Date.now()}@test.com`);
    const inversor = await crearUsuarioDeAuth(`inversor-bif4-${Date.now()}@test.com`);
    await crearPerfilUsuario(gestor.uid, 0);
    await crearPerfilUsuario(inversor.uid, 500000);
    // Etapa con solo 20 cubos disponibles: pedir 21 (dentro del rango 1–100
    // que valida la acción, pero por encima de lo realmente disponible).
    await seedProyectoBifasico(proyectoId, gestor.uid, {
      etapas: {
        tierra: etapaBase({ cubos: { totales: 100, vendidos: 80, disponibles: 20, precioPorCubo: 1000 } }),
        construccion: etapaBase({ activa: false }),
      },
    });

    const resultado = await invertirEnEtapaAction(inversor.idToken, proyectoId, 'tierra', 21);
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/cubos disponibles/i);
  });

  test('rechaza si el inversor no tiene saldo suficiente', async () => {
    const proyectoId = `proj-bif-${Date.now()}`;
    const gestor = await crearUsuarioDeAuth(`gestor-bif5-${Date.now()}@test.com`);
    const inversor = await crearUsuarioDeAuth(`inversor-bif5-${Date.now()}@test.com`);
    await crearPerfilUsuario(gestor.uid, 0);
    await crearPerfilUsuario(inversor.uid, 100);
    await seedProyectoBifasico(proyectoId, gestor.uid);

    const resultado = await invertirEnEtapaAction(inversor.idToken, proyectoId, 'tierra', 10);
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/saldo insuficiente/i);
  });

  test('rechaza invertir en un proyecto que no es bifásico', async () => {
    const proyectoId = `proj-legado-${Date.now()}`;
    const gestor = await crearUsuarioDeAuth(`gestor-bif6-${Date.now()}@test.com`);
    const inversor = await crearUsuarioDeAuth(`inversor-bif6-${Date.now()}@test.com`);
    await crearPerfilUsuario(inversor.uid, 50000);
    await setDoc(doc(db, 'productos', proyectoId), {
      nombre: 'Proyecto legado',
      creador: { id: gestor.uid },
      precio: 100000,
      inversores: [],
    });

    const resultado = await invertirEnEtapaAction(inversor.idToken, proyectoId, 'tierra', 10);
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/no usa el modelo/i);
  });

  test('rechaza invertir en una etapa inactiva', async () => {
    const proyectoId = `proj-bif-${Date.now()}`;
    const gestor = await crearUsuarioDeAuth(`gestor-bif7-${Date.now()}@test.com`);
    const inversor = await crearUsuarioDeAuth(`inversor-bif7-${Date.now()}@test.com`);
    await crearPerfilUsuario(gestor.uid, 0);
    await crearPerfilUsuario(inversor.uid, 50000);
    await seedProyectoBifasico(proyectoId, gestor.uid); // construccion arranca inactiva

    const resultado = await invertirEnEtapaAction(inversor.idToken, proyectoId, 'construccion', 10);
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/no está activa/i);
  });

  test('rechaza un ID token inválido sin tocar el proyecto ni el saldo', async () => {
    const proyectoId = `proj-bif-${Date.now()}`;
    await setDoc(doc(db, 'productos', proyectoId), {
      nombre: 'Proyecto bifásico de prueba',
      creador: { id: 'quien-sea' },
      modeloBifasico: true,
      etapas: { tierra: etapaBase(), construccion: etapaBase({ activa: false }) },
      inversores: [],
    });

    const resultado = await invertirEnEtapaAction('token-falso', proyectoId, 'tierra', 10);
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/sesión/i);

    const proyectoSnap = await getDoc(doc(db, 'productos', proyectoId));
    expect(proyectoSnap.data()?.etapas.tierra.cubos.vendidos).toBe(0);
  });
});
