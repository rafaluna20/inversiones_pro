/**
 * SISTEMA DE DOCUMENTOS LEGALES - CAJA FUERTE
 * 
 * Gestión de documentos legales con Firebase Storage
 * - Subida de archivos con verificación de integridad (SHA256)
 * - Versionado de documentos
 * - Permisos granulares (confidencial/público)
 * - Generación automática de contratos PDF
 * 
 * @version 2.0 Enterprise
 * @date 09/02/2026
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import type { Documento, TipoDocumento, Producto, Inversion } from '@/types';

// ============================================
// INTERFACES
// ============================================

export interface SubirDocumentoForm {
  proyectoId: string;
  tipo: TipoDocumento;
  titulo: string;
  descripcion?: string;
  archivo: File;
  esConfidencial?: boolean;
  usuariosAutorizados?: string[];
  fechaDocumento?: Date;
  tags?: string[];
}

// ============================================
// CALCULAR HASH SHA-256
// ============================================

/**
 * Calcular hash SHA-256 de un archivo para verificación de integridad
 */
async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================
// SUBIR DOCUMENTO LEGAL
// ============================================

/**
 * Subir documento legal a Firebase Storage y registrar en Firestore
 * 
 * @example
 * await subirDocumentoLegal({
 *   proyectoId: 'proj-123',
 *   tipo: 'titulo_propiedad',
 *   titulo: 'Título de Propiedad',
 *   archivo: pdfFile,
 *   esConfidencial: false
 * }, 'user-456');
 */
export async function subirDocumentoLegal(
  form: SubirDocumentoForm,
  usuarioId: string
): Promise<{ id: string; url: string }> {
  try {
    console.log('📄 Subiendo documento legal...');
    console.log(`   Tipo: ${form.tipo}`);
    console.log(`   Archivo: ${form.archivo.name}`);
    console.log(`   Tamaño: ${(form.archivo.size / 1024 / 1024).toFixed(2)} MB`);

    // 1. Validar tamaño (máximo 10MB)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (form.archivo.size > MAX_SIZE) {
      throw new Error('El archivo no puede exceder 10MB');
    }

    // 2. Calcular hash para verificación de integridad
    console.log('   Calculando hash SHA-256...');
    const hash = await calculateFileHash(form.archivo);

    // 3. Subir a Firebase Storage
    const timestamp = Date.now();
    const sanitizedFileName = form.archivo.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `proyectos/${form.proyectoId}/documentos/${form.tipo}/${timestamp}_${sanitizedFileName}`;

    const storageRef = ref(storage, storagePath);

    console.log('   Subiendo a Firebase Storage...');
    const snapshot = await uploadBytes(storageRef, form.archivo, {
      contentType: form.archivo.type,
      customMetadata: {
        proyectoId: form.proyectoId,
        tipo: form.tipo,
        hash: hash,
        uploadedBy: usuarioId
      }
    });

    const url = await getDownloadURL(snapshot.ref);
    console.log('   ✅ Archivo subido exitosamente');

    // 4. Registrar en Firestore
    const docRef = await addDoc(collection(db, 'documentos'), {
      proyectoId: form.proyectoId,
      tipo: form.tipo,
      titulo: form.titulo,
      descripcion: form.descripcion || '',
      archivo: {
        url,
        nombre: form.archivo.name,
        tamano: form.archivo.size,
        tipoMime: form.archivo.type,
        hash
      },
      esConfidencial: form.esConfidencial || false,
      requiereAutorizacion: form.esConfidencial || false,
      usuariosAutorizados: form.usuariosAutorizados || [],
      version: 1,
      esVersionActual: true,
      subidoPor: usuarioId,
      fechaDocumento: form.fechaDocumento ? form.fechaDocumento.getTime() : undefined,
      fechaSubida: Date.now(),
      fechaActualizacion: Date.now(),
      tags: form.tags || [form.tipo, form.proyectoId]
    });

    console.log('   ✅ Documento registrado en Firestore');
    console.log(`   ID: ${docRef.id}`);

    return {
      id: docRef.id,
      url
    };

  } catch (error) {
    console.error('❌ Error subiendo documento:', error);
    throw error;
  }
}

// ============================================
// OBTENER DOCUMENTOS
// ============================================

/**
 * Obtener documentos de un proyecto
 */
export async function obtenerDocumentosProyecto(
  proyectoId: string,
  usuarioId?: string
): Promise<Documento[]> {
  try {
    const q = query(
      collection(db, 'documentos'),
      where('proyectoId', '==', proyectoId),
      where('esVersionActual', '==', true),
      orderBy('fechaSubida', 'desc')
    );

    const snapshot = await getDocs(q);
    const documentos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Documento[];

    // Filtrar documentos confidenciales si el usuario no está autorizado
    if (usuarioId) {
      return documentos.filter(doc => {
        if (!doc.esConfidencial) return true;
        if (doc.subidoPor === usuarioId) return true;
        if (doc.usuariosAutorizados.includes(usuarioId)) return true;
        return false;
      });
    }

    // Si no hay usuario, solo devolver documentos públicos
    return documentos.filter(doc => !doc.esConfidencial);

  } catch (error) {
    console.error('Error obteniendo documentos:', error);
    return [];
  }
}

/**
 * Obtener documento por ID
 */
export async function obtenerDocumento(
  documentoId: string,
  usuarioId?: string
): Promise<Documento | null> {
  try {
    const docRef = doc(db, 'documentos', documentoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const documento = { id: docSnap.id, ...docSnap.data() } as Documento;

    // Verificar permisos
    if (documento.esConfidencial && usuarioId) {
      const tieneAcceso =
        documento.subidoPor === usuarioId ||
        documento.usuariosAutorizados.includes(usuarioId);

      if (!tieneAcceso) {
        throw new Error('No tienes permisos para acceder a este documento');
      }
    }

    return documento;

  } catch (error) {
    console.error('Error obteniendo documento:', error);
    return null;
  }
}

// ============================================
// VERIFICAR INTEGRIDAD
// ============================================

/**
 * Verificar integridad de un documento
 * Compara el hash almacenado con el hash calculado del archivo
 */
export async function verificarIntegridadDocumento(
  documentoId: string
): Promise<boolean> {
  try {
    const documento = await obtenerDocumento(documentoId);

    if (!documento) {
      throw new Error('Documento no encontrado');
    }

    // Descargar archivo
    const response = await fetch(documento.archivo.url);
    const blob = await response.blob();
    const file = new File([blob], documento.archivo.nombre);

    // Calcular hash
    const hashCalculado = await calculateFileHash(file);

    // Comparar
    const integro = hashCalculado === documento.archivo.hash;

    console.log(integro ? '✅ Documento íntegro' : '❌ Documento alterado');

    return integro;

  } catch (error) {
    console.error('Error verificando integridad:', error);
    return false;
  }
}

// ============================================
// ELIMINAR DOCUMENTO
// ============================================

/**
 * Eliminar documento (solo marca como no actual, no elimina físicamente)
 */
export async function eliminarDocumento(
  documentoId: string,
  usuarioId: string
): Promise<void> {
  try {
    const docRef = doc(db, 'documentos', documentoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Documento no encontrado');
    }

    const documento = docSnap.data() as Documento;

    // Verificar que el usuario es el que subió el documento
    if (documento.subidoPor !== usuarioId) {
      throw new Error('No tienes permisos para eliminar este documento');
    }

    // Marcar como no actual (soft delete)
    await updateDoc(docRef, {
      esVersionActual: false,
      fechaActualizacion: Date.now()
    });

    console.log('✅ Documento eliminado (marcado como no actual)');

  } catch (error) {
    console.error('Error eliminando documento:', error);
    throw error;
  }
}

// ============================================
// GENERACIÓN DE CONTRATOS PDF
// ============================================

/**
 * Generar contrato de mutuo dinerario en PDF
 * Usa jsPDF para crear el documento
 */
export async function generarContratoPDF(
  proyecto: Producto,
  inversion: Inversion
): Promise<string> {
  try {
    console.log('📄 Generando contrato PDF...');

    // Importar jsPDF dinámicamente
    const { default: jsPDF } = await import('jspdf');

    const doc = new jsPDF();

    // Configurar fuente
    doc.setFont('helvetica');

    // Encabezado
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTRATO DE MUTUO DINERARIO', 105, 20, { align: 'center' });

    // Línea separadora
    doc.setLineWidth(0.5);
    doc.line(20, 25, 190, 25);

    // Contenido
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');

    let y = 35;

    doc.text('Conste por el presente documento el CONTRATO DE MUTUO DINERARIO', 20, y);
    y += 7;
    doc.text('que celebran:', 20, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('EL MUTUANTE:', 20, y);
    doc.setFont('helvetica', 'normal');
    y += 7;
    doc.text(`Usuario ID: ${inversion.usuarioId}`, 20, y);
    y += 7;
    doc.text(`Tipo de Inversión: ${inversion.tipoInversion.toUpperCase()}`, 20, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('EL MUTUATARIO:', 20, y);
    doc.setFont('helvetica', 'normal');
    y += 7;
    doc.text(`Proyecto: ${proyecto.nombre}`, 20, y);
    y += 7;
    doc.text(`Promotor: ${proyecto.empresa}`, 20, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('DETALLES DE LA INVERSIÓN:', 20, y);
    doc.setFont('helvetica', 'normal');
    y += 7;
    doc.text(`Monto Invertido: S/ ${inversion.montoInvertido.toLocaleString()}`, 20, y);
    y += 7;
    doc.text(`Cubos Adquiridos: ${inversion.cubosComprados} (${inversion.porcentajeParticipacion}% del proyecto)`, 20, y);
    y += 7;
    doc.text(`ROI Proyectado: ${inversion.roiProyectado}%`, 20, y);
    y += 7;
    doc.text(`Ganancia Estimada: S/ ${inversion.gananciaEstimada.toLocaleString()}`, 20, y);
    y += 7;
    doc.text(`Número de Contrato: ${inversion.contrato.numeroContrato}`, 20, y);
    y += 7;
    doc.text(`Fecha: ${new Date(inversion.fechaInversion).toLocaleDateString('es-PE')}`, 20, y);
    y += 15;

    doc.setFont('helvetica', 'bold');
    doc.text('CLÁUSULAS:', 20, y);
    doc.setFont('helvetica', 'normal');
    y += 10;

    const clausulas = [
      'PRIMERA: EL MUTUATARIO reconoce haber recibido en calidad de préstamo el monto indicado.',
      'SEGUNDA: El plazo de devolución será según el cronograma del proyecto inmobiliario.',
      'TERCERA: La rentabilidad será distribuida según el modelo de Aporte de Suelo.',
      'CUARTA: El MUTUANTE tendrá derecho a participar en las decisiones del proyecto.',
      'QUINTA: El MUTUATARIO se compromete a mantener informado al MUTUANTE del progreso.'
    ];

    clausulas.forEach((clausula, index) => {
      const lines = doc.splitTextToSize(clausula, 170);
      lines.forEach((line: string) => {
        doc.text(line, 20, y);
        y += 7;
      });
      y += 3;
    });

    // Firmas
    y += 10;
    doc.line(20, y, 80, y);
    doc.line(120, y, 180, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('EL MUTUANTE', 35, y);
    doc.text('EL MUTUATARIO', 130, y);

    // Convertir a Blob
    const pdfBlob = doc.output('blob');
    const pdfFile = new File(
      [pdfBlob],
      `contrato-${inversion.contrato.numeroContrato}.pdf`,
      { type: 'application/pdf' }
    );

    // Subir como documento
    const resultado = await subirDocumentoLegal(
      {
        proyectoId: proyecto.id,
        tipo: 'contrato_compraventa',
        titulo: `Contrato ${inversion.contrato.numeroContrato}`,
        descripcion: `Contrato de mutuo dinerario - Inversión ${inversion.tipoInversion} por S/ ${inversion.montoInvertido.toLocaleString()}`,
        archivo: pdfFile,
        esConfidencial: false,
        tags: ['contrato', inversion.tipoInversion, inversion.contrato.numeroContrato]
      },
      inversion.usuarioId
    );

    console.log('✅ Contrato PDF generado y subido');

    return resultado.url;

  } catch (error) {
    console.error('❌ Error generando contrato PDF:', error);
    throw error;
  }
}

// ============================================
// AUTORIZAR USUARIO
// ============================================

/**
 * Agregar usuario a lista de autorizados para documento confidencial
 */
export async function autorizarUsuarioDocumento(
  documentoId: string,
  usuarioId: string,
  autorizadoPor: string
): Promise<void> {
  try {
    const docRef = doc(db, 'documentos', documentoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Documento no encontrado');
    }

    const documento = docSnap.data() as Documento;

    // Verificar que quien autoriza es el creador del proyecto
    // (Aquí deberías verificar que autorizadoPor sea admin/creador)

    if (!documento.usuariosAutorizados.includes(usuarioId)) {
      await updateDoc(docRef, {
        usuariosAutorizados: [...documento.usuariosAutorizados, usuarioId],
        fechaActualizacion: Date.now()
      });

      console.log(`✅ Usuario ${usuarioId} autorizado para documento ${documentoId}`);
    }

  } catch (error) {
    console.error('Error autorizando usuario:', error);
    throw error;
  }
}
