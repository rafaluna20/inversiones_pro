import {
  LeadingActions,
  SwipeableList,
  SwipeableListItem,
  SwipeAction,
  TrailingActions,
} from "react-swipeable-list";
import "react-swipeable-list/dist/styles.css";
// formatDistanceToNow
import { useRouter } from "next/router";
import React, { useEffect, useContext, useState } from "react";
import { FirebaseContext } from "../../firebase";
import {
  collection,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import Error404 from "../../components/layout/404";
import Layout from "../../components/layout/Layout";
import { css, keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import formatDistanceToNow from "date-fns/formatDistanceToNow";
import { de, es } from "date-fns/locale";
import { Campo, InputSubmit, Invertir } from "../../components/ui/Formulario";
import Boton from "../../components/ui/Boton1";
import Spinner from "../../components/ui/Spinner";
import MapPage from "@/components/ui/MapaPrueba";
import MapaAnimada from "@/components/ui/MapaAnimada";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import Mensaje from "@/components/ui/Mensaje";
import restarSaldo from "@/Validacion/restarSaldo";
import sumarSaldo from "@/Validacion/actualizarSaldo";
import restarSaldoCreador from "@/Validacion/restarSaldoCreador";
import SpinnerPrincipal from "@/components/ui/SpinnerPrincipal";
import enviarGanancia from "@/Validacion/enviarGanancia";
import SliderProducto from "@/components/ui/SliderProducto";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { ImLink } from "react-icons/im";

import obtenerPhone from "@/Validacion/obtenerPhone";
import restarSaldoGanancia from "@/Validacion/repartirGanancia";
import obtenerDatosExtras from "@/Validacion/obtenerDatosExtras";
import restarSaldoAcumulado from "@/Validacion/restarSaldoAcumulado";
import sumarSaldoAcumulado from "@/Validacion/sumaSaldoAcumulado";
const ContenedorProducto = styled.div`
  display: grid;
  gap: 60px;
  grid-auto-rows: auto;
  grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
  @media (max-width: 550px) {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }
`;
const CreadorProducto = styled.p`
  padding: 0.5rem 2rem;
  background-color: #da552f;
  color: #fff;
  text-transform: uppercase;
  font-weight: bold;
  display: inline-block;
  text-align: center;
  position: absolute;
  bottom: 25px;
  right: 5px;
  @media (max-width: 550px) {
    background-color: red;
    top: 15px;
    bottom: 0;
  }
`;
const contenedorBarra = styled.div`
  margin-top: 20px !important;
  background-color: red;
  height: 300px;
  width: 300px;
`;
const Mapa = styled.div`
  z-index: 1;
  width: 100%;
  height: 400px;
  border: 1px solid #e1e1e1;
  margin-bottom: 20px;
`;
//estilo modal
const Contenedor = styled.div`
  position: fixed;
  z-index: 200;
  background-color: rgb(0 0 0 / 0.92);
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  .cerrar-modal {
    position: absolute;
    right: 3rem;
    top: 3rem;
    width: 2rem;
    height: 2rem;
    z-index: 2;
    img {
      width: 100%;
    }
  }
  form {
    width: 400px;
    margin: 0 auto;
    padding: 3rem 0;
    legend {
      font-size: 3.5rem;
      text-align: center;
      display: block;
      text-transform: uppercase;
      color: white;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #3b82f6;
    }
    .campo {
      display: grid;
      margin-bottom: 2rem;
    }
    label {
      color: white;
      font-size: 2rem;
      margin-bottom: 1rem;
    }
    input[type="text"],
    input[type="number"] {
      background-color: white;
      border-radius: 1rem;
      padding: 1rem;
      border: none;
      flex: 1;
      font-size: 1.5rem;
    }
    input[type="submit"] {
      background-color: #1048a4;
      border: none;
      padding: 1rem;
      text-align: center;
      color: white;
      font-weight: 900;
      text-transform: uppercase;
      font-size: 1.5rem;
      width: 100%;
      transition: background-color 300ms ease;
      :hover {
        background-color: #042a67;
        cursor: pointer;
      }
    }
    select {
      flex: 1;
      padding: 0.8rem;
      border: none;
      border-radius: 1rem;
      text-align: center;
      background-color: white;
    }
  }
  label {
    color: white;
    text-align: left;
  }
  .formulario.animar {
    position: relative;
    opacity: 1;
    z-index: 1;
  }
  .formulario.cerrar {
    opacity: 0;
  }
`;

//estilo precio
const Precio = styled.p`
  margin-top: 10px;
  font-size: 30px;
  margin-bottom: 10px;
  span {
    font-size: 15px;
  }
  @media (max-width: 550px) {
    font-size: 15px;
    span {
      font-size: 12px;
    }
  }
`;
const lista = styled.ul`
  .swipe-action__leading {
    background-color: var(--azul);
    color: var(--blanco);
    margin-bottom: 2rem;
  }

  .swipe-action__trailing {
    background-color: #db2777;
    margin-bottom: 2rem;
    color: var(--blanco);
  }

  .swipeable-list .swipe-action {
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 2.4rem;
    text-align: right;
  }
`;
const Publicado = styled.p`
  margin-bottom: 5px;
  @media (max-width: 550px) {
    font-size: 12px;
  }
`;
const ListaComentario = styled.li`
  display: grid;
  grid-template-columns: 0.5fr 5fr;
  .contenedorPerfil {
    display: flex;
    align-items: center;
    justify-content: center;
    img {
      border-radius: 100%;
      height: 50px;
      width: 50px;
    }
  }
`;

const GeneralDescripcion = styled.div`
  position: relative;
  border: 1px solid #e1e1e1;
  background-color: var(--colorBarraSuperior);
  margin-top: 20px;
  margin-bottom: 30px;
  padding: 50px;

  .nombreProducto {
    display: flex;
    align-items: center;
    justify-content: space-between;
    .iconoProducto {
      display: flex;
      align-items: center;
      gap: 20px;
    }
  }
  .bx {
    font-size: 30px;
    cursor: pointer;
  }
  .bx-map {
    color: #dc2626;
    cursor: pointer;
  }
  .bxl-whatsapp {
    color: #3ff71a;
  }
  .iconosExtra {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 15px;
    div {
      display: flex;
      align-items: center;
      flex-direction: column;
      padding: 8px;
      border-radius: 6px;
      background-color: var(--grisBotones);
    }
  }
  .botones {
    position: absolute;
    right: 50px;
    bottom: 50px;
    display: flex;
    justify-content: space-around;
    gap: 5px;

    button {
      padding: 10px 20px;
      font-size: 20px;
      color: white;
      border-radius: 10px;
      text-align: center;
      text-transform: uppercase;
      font-family: "PT Sans", sans-serif;
    }

    @media (max-width: 1300px) {
      margin-top: 20px;
      position: static;
      button {
        padding: 5px 10px;
        font-size: 15px;
        /* :last-child {
          margin-left: 10px;
        } */
      }
    }
  }
`;
const Comentarios = styled.div`
  height: 160px;
  background-color: var(--colorBarraSuperior);
  padding: 20px;
  margin-bottom: 15px;
  input[type="submit"] {
    background-color: var(--botones);
    width: 50%;
    padding: 1.5rem;
    text-align: center;
    color: #fff;
    font-size: 1.8rem;
    text-transform: uppercase;
    border: none;
    font-family: "PT Sans", sans-serif;
    font-weight: 700;

    @media (max-width: 1200px) {
      width: 100%;
    }
  }
  .enviarComentario {
    display: flex;
    justify-content: center;
  }
`;
const RutaWeb = styled.div`
  height: 160px;

  display: flex;
  align-items: center;
  justify-content: space-around;
  background-color: var(--colorBarraSuperior);
  padding: 20px;
  margin-bottom: 15px;
  a {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    font-weight: 700;
    text-transform: uppercase;
    text-align: center;
    color: white;
  }
  .cantVotos {
    background-color: var(--grisBotones);
    align-items: center;
    display: flex;
    justify-content: center;
    gap: 5px;
    padding: 10px 0;
    border-radius: 10px 10px 0 0;
  }
  .votarUsuario {
    border: 1px solid #d1d1d1;
    border-radius: 10px;
  }
`;
const ListaComentarios = styled.div`
  padding: 30px;
  border: 1px solid #e1e1e1;
  max-height: 500px;
  overflow-y: auto;
`;
const BotonVotar = styled.a`
  display: block;
  font-weight: 700;
  text-transform: uppercase;
  border-top: 1px solid #d1d1d1;
  padding: 0.8rem 2rem;
  text-align: center;
  background-color: var(--botones);
  cursor: pointer;
  border-radius: 0 0 10px 10px;
`;

const BotonDepositar = styled.button`
  background-color: var(--botones);
  cursor: pointer;
  padding: 10px 20px;
  font-size: 20px;
  color: white;
  border-radius: 10px;
  text-align: center;
  text-transform: uppercase;
  margin-bottom: 10px;
  font-weight: bold;
  @media (max-width: 1300px) {
    padding: 5px 10px;
    font-size: 15px;
  }
`;
const Producto = () => {
  //state del componente
  const [producto, guardarProducto] = useState({});
  const [error, guardarError] = useState(false);
  //comentarios
  const [comentario, guardarComentario] = useState({});
  const [inputComentario, SetInputComentario] = useState("");

  const [consultarDB, guardarConsultarDB] = useState(true);
  const [paseModal, guardarModal] = useState(false);
  const [paseModalGanancia, guardarPaseModalGanancia] = useState(false);
  const [paseModalPrecio, guardarPaseModalPrecio] = useState(false);
  //state inversores
  const [inver, guardarinver] = useState({});
  const [inputDesInversor, setInputDesInversor] = useState("");
  const [inputCuboInversor, setInputCuboInversor] = useState("");
  const [inputGanancia, setInputGanancia] = useState("");
  const [inputPrecio, setInputPrecio] = useState("");
  const [inputCategoriaInversor, setInputCategoriaInversor] = useState();
  const [pase, setPase] = useState(false);
  const [numElementos, setNumElementos] = useState(0); // Nuevo estado para el número de elementos
  const [editarInversion, setEditarInversion] = useState(true);
  const [inverEncontrado, setInverEncontrado] = useState();
  const [depositarRecaudado, setDepositarRecaudado] = useState(false);
  const [bloquearBoton, setBloquearBoton] = useState(false);
  const [montoRecaudado, setMontoRecaudado] = useState(0);
  //mensaje error
  const [mensaje, setMensaje] = useState("");
  //cantida de cubos
  const [totalCubos, setTotalCubos] = useState(0);
  //routing para obtener el id actual
  const router = useRouter();
  const {
    query: { id },
  } = router;
  //context de firebase
  const { firebase, usuario } = useContext(FirebaseContext);
  const [phone, setPhone] = useState();

  const {
    comentarios,
    creado,
    descripcion,
    empresa,
    nombre,
    url,
    urlimagen,
    votos,
    creador,
    haVotado,
    cordenadas,
    categoria,
    inversores,
    precio,
    estado,
    monto,
    depositoRecaudado,
  } = producto;
  //elimina un producto de la bd
  const eliminarProducto = async () => {
    if (!usuario) {
      return router.push("/login");
    }
    if (creador.id !== usuario.uid) {
      return router.push("/");
    }
    try {
      const docRef = doc(firebase.db, "productos", `${id}`);
      await deleteDoc(docRef);
      router.push("/");
    } catch (error) {
      console.log("error");
    }
  };
  useEffect(() => {
    if (usuario) {
      const usuarioDocRef = doc(firebase.db, "usuarios", usuario.uid);

      const unsuscribeUsuario = onSnapshot(usuarioDocRef, (usuarioDoc) => {
        if (
          usuarioDoc.exists() &&
          usuarioDoc.data().saldoRecaudado !== undefined
        ) {
          const saldosRecaudados = usuarioDoc.data().saldoRecaudado;

          const saldoProducto = saldosRecaudados.find(
            (saldo) => saldo.idProducto === id
          );

          if (saldoProducto) {
            setMontoRecaudado(saldoProducto.monto);
          } else {
            setMontoRecaudado(0);
          }
        }
      });

      return () => {
        unsuscribeUsuario();
      };
    }
  }, [usuario, id, producto]);

  useEffect(() => {
    if (producto) {
      const productoDocRef = doc(firebase.db, "productos", `${id}`);

      const unsuscribeUsuario = onSnapshot(productoDocRef, (productoDoc) => {
        // Lógica para manejar cambios en el documento individual del usuario
        // console.log("El documento del usuario ha cambiado:", usuarioDoc.data());

        // Asegúrate de que el campo 'saldo' esté presente antes de intentar recuperarlo
        if (productoDoc.exists()) {
          guardarProducto(productoDoc.data());
        }
      });

      // La función de limpieza se ejecutará al desmontar el componente
      return () => {
        unsuscribeUsuario();
      };
    }
  }, [producto]);

  const recuperarPhone = async () => {
    if (creador) {
      const phoneUsuario = await obtenerPhone(creador.id);
      setPhone(phoneUsuario);
    }
  };
  const actualizarInversorPorId = async () => {
    const docRef = doc(firebase.db, "productos", `${id}`);
    try {
      // Obtiene el documento actual
      guardarModal(true);
      setEditarInversion(false);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        // Obtiene el array inversores del documento
        const inversores = await docSnap.data().inversores;

        // Busca el inversor que coincide con el idUsuario
        const inversorEncontrado = await inversores.find(
          (inversor) => inversor.usuarioId === usuario.uid
        );

        if (inversorEncontrado) {
          setInverEncontrado(inversorEncontrado);
          setInputDesInversor(inversorEncontrado.descripcion);
          setInputCuboInversor(inversorEncontrado.cubos);
          setInputCategoriaInversor(inversorEncontrado.categoria);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const eliminarInversorPorId = async () => {
    setEditarInversion(true);

    try {
      const docRef = doc(firebase.db, "productos", `${id}`);

      // Obtener el documento actual
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        // Obtener el array de inversores del documento
        const inversores = docSnap.data().inversores;

        // Filtrar el array para eliminar el elemento con el idUsuario deseado
        const nuevoInversores = inversores.filter(
          (inversor) => inversor.usuarioId !== usuario.uid
        );

        const inversorEliminado = inversores.filter(
          (inversor) => inversor.usuarioId === usuario.uid
        );
        const aumento = (inversorEliminado[0]["cubos"] * precio) / 100;
        await sumarSaldo(usuario.uid, aumento);
        // await restarSaldo(creador.id, creador.id, aumento);
        await restarSaldoAcumulado(creador.id, id, aumento);
        // if (usuario.uid !== creador.id) {
        //   await restarSaldoCreador(creador.id, aumento);
        // }

        // Actualizar el documento con el nuevo array de inversores
        await updateDoc(docRef, { inversores: nuevoInversores });
        //actualizar el state
        guardarProducto({
          ...producto,
          inversores: nuevoInversores,
        });
        setPase(false);
        guardarConsultarDB(true); //hay un voto, por lo tanto consultar a la db
      } else {
        console.log("El documento no existe");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };
  useEffect(() => {
    const ejecutar = async () => {
      const docRef = doc(firebase.db, "productos", `${id}`);
      try {
        // Obtiene el documento actual
        const docSnap = await getDoc(docRef);
        // Obtiene el array inversores del documento
        const inversores = docSnap.data().inversores;
        // Busca el inversor que coincide con el idUsuario
        const inversorEncontrado = inversores.find(
          (inversor) => inversor.usuarioId === usuario.uid
        );

        // const { saldoRecaudado } = await obtenerDatosExtras(creador.id);
        // setMontoRecaudado(saldoRecaudado);
        if (inversorEncontrado) {
          setPase(true);
        }
      } catch (error) {
        console.error(error);
      }
    };

    // Llama a la función ejecutar una vez que la página se haya cargado
    ejecutar();
  }, [producto]);
  useEffect(() => {
    if (id && consultarDB) {
      const obtenerProducto = async () => {
        const productoQuerry = await doc(
          collection(firebase.db, "productos"),
          id
        );
        const producto = await getDoc(productoQuerry);
        if (producto.exists()) {
          guardarProducto(producto.data());
          guardarConsultarDB(false);
        } else {
          guardarError(true);
          guardarConsultarDB(false);
        }
      };
      obtenerProducto();
      recuperarPhone();
    }
  }, [id, producto, usuario]);

  useEffect(() => {
    let suma = 0;
    const sumaTotal = async () => {
      if (inversores) {
        inversores.map((inversor) => {
          suma = suma + inversor.cubos;
        });
        await setTotalCubos(suma);
      } else {
        suma = 0;
      }
    };
    sumaTotal();
  }, [producto, numElementos, totalCubos]);

  if (Object.keys(producto).length === 0 && !error) return <SpinnerPrincipal />;

  //administrar y validar votos
  const votarProducto = () => {
    setBloquearBoton(true);
    if (!usuario) {
      return router.push("/login");
    }
    //verificar si el usuario actual ha votado
    if (haVotado.includes(usuario.uid)) {
      return;
    }
    //guardar el ID del usuario que ha votado
    const nuevoHaVotado = [...haVotado, usuario.uid];
    const nuevoTotal = votos + 1;

    //actualizar en la bd
    const docRef = doc(firebase.db, "productos", `${id}`);
    updateDoc(docRef, {
      votos: nuevoTotal,
      haVotado: nuevoHaVotado,
    });
    //actualizar el state
    guardarProducto({
      ...producto,
      votos: nuevoTotal,
    });
    guardarConsultarDB(true); //hay un voto, por lo tanto consultar a la db
    setTimeout(() => {
      setBloquearBoton(false);
    }, 1000);
  };

  //funciones para crear comentario

  const comentariosChange = (e) => {
    guardarComentario({
      ...comentario,
      [e.target.name]: e.target.value,
    });
    SetInputComentario(e.target.value);
  };

  const inversorDesChange = (e) => {
    guardarinver({
      ...inver,
      [e.target.name]: e.target.value,
    });
    setInputDesInversor(e.target.value);
  };
  const inversorCuboChange = (e) => {
    guardarinver({
      ...inver,
      [e.target.name]: Number(e.target.value),
    });
    setInputCuboInversor(Number(e.target.value));
  };
  const gananciaChange = (e) => {
    setInputGanancia({
      ...inver,
      [e.target.name]: Number(e.target.value),
    });
    setInputGanancia(Number(e.target.value));
  };

  const inversorCategoriaChange = (e) => {
    guardarinver({
      ...inver,
      [e.target.name]: e.target.value,
    });
    setInputCategoriaInversor(e.target.value);
  };

  //identifica si el comentario es del creador del producto
  const esCreador = (id) => {
    if (creador.id == id) {
      return true;
    } else {
      return false;
    }
  };

  const esCreadorInversor = (id) => {
    if (usuario != null) {
      if (usuario.uid == id) {
        return true;
      } else {
        return false;
      }
    }
  };

  const agregarComentario = async (e) => {
    e.preventDefault();
    if (!usuario) {
      return router.push("/login");
    }
    if (inputComentario.trim() === "") return;

    //informacion extra al comentario
    comentario.usuarioId = usuario.uid;
    comentario.usuarioNombre = usuario.displayName;
    comentario.fecha = Date.now();
    comentario.icono = usuario.photoURL;

    // tomar copia de comentarios y agregar al arreglo

    const nuevosComentarios = [...comentarios, comentario];
    //actualizar la bd
    const docRef = doc(firebase.db, "productos", `${id}`);
    updateDoc(docRef, {
      comentarios: nuevosComentarios,
    });
    //actualizar el state
    guardarProducto({
      ...producto,
      comentarios: nuevosComentarios,
    });
    guardarConsultarDB(true); //hay un conentario, por lo tanto consultar a la db
    SetInputComentario("");
  };

  //funcion que revisa que el creador del producto sea el mismo que esta autenticado
  const puedeBorrar = () => {
    if (!usuario) return false;
    if (creador.id === usuario.uid) {
      return true;
    }
  };

  //nueva inversion
  const handleNuevaInversion = () => {
    guardarModal(true);
  };
  const handleGanancia = () => {
    guardarPaseModalGanancia(true);
  };
  //funcion ocultarmodal
  const ocultarModal = () => {
    guardarModal(false);
    guardarPaseModalGanancia(false);
    guardarPaseModalPrecio(false);
  };
  //funcion submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      [inputDesInversor, inputCuboInversor, inputCategoriaInversor].includes("")
    ) {
      setMensaje("Todos los campos son obligatorios");
      setTimeout(() => {
        setMensaje("");
      }, 2000);
      return;
    }
    if (inverEncontrado) {
      if (
        totalCubos + parseInt(inputCuboInversor) - inverEncontrado.cubos >
        100
      ) {
        setMensaje("La cantidad de cubos ingresados supera a los disponibles");
        setTimeout(() => {
          setMensaje("");
        }, 2000);
        return;
      }
    } else {
      if (totalCubos + parseInt(inputCuboInversor) > 100) {
        setMensaje("La cantidad de cubos ingresados supera a los disponibles");
        setTimeout(() => {
          setMensaje("");
        }, 2000);
        return;
      }
    }

    // guardarModal(false);
    const docRef = doc(firebase.db, "productos", `${id}`);
    const docSnap = await getDoc(docRef);
    if (!usuario) {
      return router.push("/login");
    }

    if (docSnap.exists()) {
      // Obtener el array de inversores del documento
      const inversores = docSnap.data().inversores;
      let existeInversor;
      if (inversores != undefined) {
        // Filtrar el array para eliminar el elemento con el idUsuario deseado
        existeInversor = inversores.filter(
          (inversor) => inversor.usuarioId === usuario.uid
        );
      }

      if (existeInversor != undefined && existeInversor.length != 0) {
        // Encuentra el índice del elemento que coincide con el idUsuario deseado
        const nuevosCampos = {
          descripcion: inputDesInversor,
          categoria: inputCategoriaInversor,
          cubos: inputCuboInversor,
          fecha: Date.now(),
        };
        const indice = inversores.findIndex(
          (inversor) => inversor.usuarioId === usuario.uid
        );
        const valorViejo =
          (parseFloat(existeInversor[0]["cubos"]) * precio) / 100;
        await sumarSaldo(usuario.uid, valorViejo);
        // await restarSaldo(creador.id, creador.id, valorViejo);
        await restarSaldoAcumulado(creador.id, id, valorViejo);
        // await restarSaldoCreador(creador.id, valorViejo);
        const nuevaResta = (inputCuboInversor * precio) / 100;
        const mensajeRespuesta = await restarSaldo(
          usuario.uid,
          creador.id,
          nuevaResta
        );
        if (mensajeRespuesta) {
          console.log(mensajeRespuesta);
          setMensaje(mensajeRespuesta);
          setTimeout(() => {
            setMensaje("");
          }, 2000);
          return;
        } else {
          if (indice !== -1) {
            // Actualiza los campos del elemento con los nuevos valores
            if (inversores != undefined) {
              inversores[indice] = { ...inversores[indice], ...nuevosCampos };
              const nuevos = [...inversores];
              await sumarSaldoAcumulado(creador.id, id, nuevaResta);
              // await sumarSaldo(creador.id, nuevaResta);

              // Actualiza el documento con el array actualizado
              await updateDoc(docRef, { inversores });
              guardarProducto({
                ...producto,
                inversores: nuevos,
              });
              console.log("Elemento actualizado con éxito");
            }
            guardarModal(false);
          }
        }
      } else {
        //informacion extra
        let resta = (inputCuboInversor * precio) / 100;
        const respuesta = await restarSaldo(usuario.uid, creador.id, resta);
        if (respuesta) {
          console.log(respuesta);
          setMensaje(respuesta);
          setTimeout(() => {
            setMensaje("");
          }, 2000);
          return;
        } else {
          await sumarSaldoAcumulado(creador.id, id, resta);
          // await sumarSaldo(creador.id, resta);

          guardarModal(false);

          inver.usuarioId = usuario.uid;
          inver.usuarioNombre = usuario.displayName;
          inver.icono = usuario.photoURL;
          inver.fecha = Date.now();

          //copia de inversores
          if (inversores != undefined) {
            const nuevosInversores = [...inversores, inver];
            //actualizar la bd
            updateDoc(docRef, {
              inversores: nuevosInversores,
            });
            //actulizar el state
            guardarProducto({
              ...producto,
              inversores: nuevosInversores,
            });
          }
        }
      }
    }
    localStorage.setItem("pase", true);
    setPase(true);
    setInputDesInversor("");
    setInputCuboInversor("");
    setInputCategoriaInversor("");
  };
  const formatearPresupuesto = (cantidad) => {
    return cantidad.toLocaleString("es-PE", {
      style: "currency",
      currency: "PEN",
    });
  };
  const leadingActions = () => (
    <LeadingActions>
      <SwipeAction onClick={actualizarInversorPorId}>Editar</SwipeAction>
    </LeadingActions>
  );
  const trailingActions = () => (
    <TrailingActions>
      <SwipeAction onClick={eliminarInversorPorId} destructive={true}>
        Eliminar
      </SwipeAction>
    </TrailingActions>
  );
  const scrollToSection = () => {
    const sectionDestino = document.getElementById("mapaProducto");
    if (sectionDestino) {
      sectionDestino.scrollIntoView({ behavior: "smooth" });
    }
  };
  const hadleRepartirGanancia = async (e) => {
    e.preventDefault();
    if (inputGanancia == "") {
      setMensaje("Ingrese un monto");
      return;
    }
    try {
      const docRef = doc(firebase.db, "productos", `${id}`);

      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        // Obtener el array de inversores del documento
        const estado = docSnap.data().estado;
        const monto = docSnap.data().monto;

        // Filtrar el array para eliminar el elemento con el idUsuario deseado
        await updateDoc(docRef, {
          estado: false,
          monto: inputGanancia,
        });
        console.log("actualizado con exito el estado");
        guardarProducto({
          ...producto,
          estado: false,
          monto: inputGanancia,
        });
        guardarConsultarDB(true);
        const montoRestar = (parseInt(precio) * totalCubos) / 100;
        await restarSaldoGanancia(usuario.uid, creador.id, inputGanancia);
        await enviarGanancia(inversores, inputGanancia, precio);
        guardarPaseModalGanancia(false);
        //actulizar el state
        guardarProducto({
          ...producto,
          estado: false,
        });
      } else {
        console.log("El documento no existe");
      }
    } catch (error) {}
  };
  const recuperarCubos = () => {
    let resultado;
    const respuesta = inversores.filter(
      (inversor) => inversor.usuarioId === usuario.uid
    );
    if (respuesta.length > 0) {
      resultado = respuesta[0]["cubos"];
    }
    return resultado;
  };

  const handleRecaudado = async (e) => {
    e.preventDefault();
    try {
      const docRef = doc(firebase.db, "productos", `${id}`);

      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        // Obtener el array de inversores del documento
        const depositoRecaudado = docSnap.data().depositoRecaudado;

        // Filtrar el array para eliminar el elemento con el idUsuario deseado
        await updateDoc(docRef, {
          depositoRecaudado: true,
        });
        console.log("actualizado con exito el depositoRecaudado");
        guardarProducto({
          ...producto,
          depositoRecaudado: true,
        });
        guardarConsultarDB(true);
      } else {
        console.log("El documento no existe");
      }
    } catch (error) {}
    const montoDepositar = (parseInt(precio) * totalCubos) / 100;
    sumarSaldo(creador.id, montoDepositar);
  };

  const handleModificarPrecio = () => {
    guardarPaseModalPrecio(true);
  };
  const hadleModificarNuevoPrecio = async (e) => {
    e.preventDefault();
    try {
      const docRef = doc(firebase.db, "productos", `${id}`);

      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const precio = docSnap.data().precio;
        if (inputPrecio !== "") {
          await updateDoc(docRef, {
            precio: inputPrecio,
          });
          console.log("actualizado con exito el estado");
          guardarProducto({
            ...producto,
            precio: inputPrecio,
          });
          guardarConsultarDB(true);
          setInputPrecio("");
          guardarPaseModalPrecio(false);
        } else {
          setMensaje("Ingrese un precio valido");
          guardarPaseModalPrecio(true);
          setTimeout(() => {
            setMensaje("");
          }, 2000);
        }
      } else {
        console.log("El documento no existe");
      }
    } catch (error) {}
  };
  const handleDepositarRecaudado = async () => {
    await sumarSaldo(creador.id, montoRecaudado);
    await restarSaldoAcumulado(creador.id, id, precio);
    // cambiar el saldo recáudado
    const docRef = doc(firebase.db, "productos", `${id}`);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      await updateDoc(docRef, {
        depositoRecaudado: true,
      });
      guardarProducto({
        ...producto,
        depositoRecaudado: true,
      });
      guardarConsultarDB(true);
    } else {
      console.log("El documento no existe");
    }
  };
  recuperarPhone();
  return (
    <Layout>
      <>
        {error ? (
          <Error404 />
        ) : (
          <div
            css={css`
              padding-left: 20px;
              padding-right: 20px;
              color: white;
              @media (min-width: 1000px) {
                margin-left: 300px;
              }
              @media (max-width: 1000px) {
                margin-bottom: 60px;
              }
            `}
          >
            {paseModalPrecio && (
              <Contenedor className="modal">
                <div className="cerrar-modal">
                  <img
                    src="/static/img/cerrar.svg"
                    alt="cerrar modal"
                    onClick={ocultarModal}
                  />
                </div>

                <form
                  className="formulario"
                  onSubmit={hadleModificarNuevoPrecio}
                >
                  <legend>Modificar Precio</legend>

                  {mensaje && <Mensaje tipo="error">{mensaje}</Mensaje>}

                  <div className="campo">
                    <label htmlFor="precio">Nuevo Precio</label>
                    <input
                      autocomplete="off"
                      id="precio"
                      type="number"
                      name="precio"
                      placeholder="Ingrese el nuevo precio"
                      min={1}
                      value={inputPrecio}
                      onChange={(e) => {
                        setInputPrecio(e.target.value);
                      }}
                    />
                  </div>

                  <input type="submit" value="Modificar Precio" />
                </form>
              </Contenedor>
            )}
            {paseModalGanancia && (
              <Contenedor className="modal">
                <div className="cerrar-modal">
                  <img
                    src="/static/img/cerrar.svg"
                    alt="cerrar modal"
                    onClick={ocultarModal}
                  />
                </div>

                <form className="formulario" onSubmit={hadleRepartirGanancia}>
                  <legend>Repartir Ganancia</legend>
                  <div
                    css={css`
                      margin-bottom: 5px;
                      color: white;
                      font-size: 20px;
                      text-align: center;
                      span {
                        color: #3b82f6;
                        font-size: 25px;
                      }
                    `}
                  >
                    Cantidad de inversores
                    <span> {inversores.length}</span>
                  </div>
                  {mensaje && <Mensaje tipo="error">{mensaje}</Mensaje>}

                  <div className="campo">
                    <label htmlFor="cantidad">Monto total</label>
                    <input
                      autocomplete="off"
                      id="cantidad"
                      type="number"
                      name="ganancia"
                      placeholder="Añade el monto total recaudado"
                      min={1}
                      value={inputGanancia}
                      onChange={gananciaChange}
                    />
                  </div>

                  <input type="submit" value="Enviar Ganancia" />
                </form>
              </Contenedor>
            )}

            {paseModal && (
              <Contenedor className="modal">
                <div className="cerrar-modal">
                  <img
                    src="/static/img/cerrar.svg"
                    alt="cerrar modal"
                    onClick={ocultarModal}
                  />
                </div>

                <form className="formulario" onSubmit={handleSubmit}>
                  <legend>
                    {editarInversion ? "Nueva Inversión" : "Editar Inversión"}
                  </legend>
                  <div
                    css={css`
                      margin-bottom: 5px;
                      color: white;
                      font-size: 20px;
                      text-align: center;
                      span {
                        color: #3b82f6;
                        font-size: 25px;
                      }
                    `}
                  >
                    Cantidad de cubos disponibles{" "}
                    <span>{100 - totalCubos}</span>
                  </div>
                  {mensaje && <Mensaje tipo="error">{mensaje}</Mensaje>}

                  <div className="campo">
                    <label htmlFor="nombre">Descripción</label>
                    <input
                      id="nombre"
                      type="text"
                      name="descripcion"
                      placeholder="Añade una descripcion de la inversion"
                      autocomplete="off"
                      value={inputDesInversor}
                      onChange={inversorDesChange}
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="cantidad">Cantidad de Cubos</label>
                    <input
                      autocomplete="off"
                      id="cantidad"
                      type="number"
                      name="cubos"
                      placeholder="Añade la cantidad del cubos: ej. 10"
                      min={1}
                      max={100}
                      value={inputCuboInversor}
                      onChange={inversorCuboChange}
                      step="0.01"
                    />
                  </div>

                  <div className="campo">
                    <label htmlFor="categoria">Categoria</label>

                    <select
                      id="categoria"
                      name="categoria"
                      value={inputCategoriaInversor}
                      onChange={inversorCategoriaChange}
                    >
                      <option value="">-- Seleccione --</option>
                      <option value="Basico">Básico</option>
                      <option value="Medio">Medio</option>
                      <option value="Avanzado">Avanzado</option>
                    </select>
                  </div>
                  <input
                    type="submit"
                    value={
                      editarInversion ? "Añadir Inversion" : "Editar Inversion"
                    }
                  />
                </form>
              </Contenedor>
            )}
            <GeneralDescripcion>
              <div
                css={css`
                  width: 100%;
                  display: flex;
                  justify-content: center;
                `}
              >
                <SliderProducto images={urlimagen} />
              </div>
              <div className="nombreProducto">
                <div
                  css={css`
                    font-size: 20px;
                  `}
                >
                  {nombre}
                </div>
                <div className="iconoProducto">
                  <div className="ubicacion" onClick={scrollToSection}>
                    <i class="bx bx-map"></i>
                  </div>

                  <a href={`https://wa.me/${phone}`} target="_blank">
                    <div className="whatsapp">
                      <i class="bx bxl-whatsapp"></i>
                    </div>
                  </a>
                </div>
              </div>
              <div
                css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  gap: 20px;
                `}
              >
                <div>
                  <Precio>{formatearPresupuesto(parseInt(precio))}</Precio>
                  {estado &&
                    esCreador(usuario?.uid) &&
                    depositoRecaudado == false &&
                    inversores.length == 0 && (
                      <BotonDepositar onClick={handleModificarPrecio}>
                        Modificar Precio
                      </BotonDepositar>
                    )}
                </div>
                {creador.id == usuario?.uid && depositoRecaudado == false && (
                  <div
                    css={css`
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      flex-direction: column;
                    `}
                  >
                    <div
                      css={css`
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        gap: 10px;
                      `}
                    >
                      <p
                        css={css`
                          font-size: 20px;
                          font-weight: bold;
                        `}
                      >
                        Monto Recaudado:
                      </p>
                      <Precio>
                        {formatearPresupuesto(parseInt(montoRecaudado))}
                      </Precio>
                    </div>
                    {montoRecaudado === parseInt(precio) &&
                      depositoRecaudado == false && (
                        <BotonDepositar onClick={handleDepositarRecaudado}>
                          Depositar Recaudado
                        </BotonDepositar>
                      )}
                  </div>
                )}
              </div>
              <div
                css={css`
                  display: flex;
                  justify-content: space-between;
                  @media (max-width: 550px) {
                    flex-direction: column;
                  }
                `}
              >
                <div className="iconosExtra">
                  <div>
                    <i class="bx bx-message-rounded-dots"></i>{" "}
                    <p>{comentarios.length}</p>
                  </div>
                  <div className="corazon">
                    {haVotado.includes(usuario?.uid) ? (
                      <FaHeart className="bx" />
                    ) : (
                      <button
                        css={css`
                          border: none; /* Sin borde */
                          background-color: transparent; /* Fondo transparente */
                          padding: 0; /* Sin relleno */
                          margin: 0; /* Sin márgenes */
                          cursor: pointer; /* Opcional, cursor de mano al pasar por encima */
                          outline: none; /* Sin contorno de foco por defecto */
                          color: white;
                        `}
                        onClick={votarProducto}
                        disabled={bloquearBoton}
                      >
                        <FaRegHeart className="bx" />
                      </button>
                    )}

                    <p>{votos}</p>
                  </div>
                  <div className="corazon">
                    <i class="bx bx-cube"></i>
                    <p>{100 - totalCubos}</p>
                  </div>
                </div>
                <div
                  css={css`
                    font-weight: bold;
                    p {
                      font-size: 20px;
                    }
                  `}
                >
                  {pase == true && estado == false && (
                    <>
                      <p>
                        Tu Inversion:{" "}
                        <span>
                          {formatearPresupuesto(
                            (recuperarCubos() * precio) / 100
                          )}
                        </span>
                      </p>
                      <p>
                        Tu Ganancia:{" "}
                        <span>
                          {formatearPresupuesto(
                            ((monto - precio) * recuperarCubos()) / 100
                          )}
                        </span>
                      </p>
                    </>
                  )}
                </div>
              </div>

              <p
                css={css`
                  font-size: 15px;
                `}
              >
                Publicado hace :{" "}
                {formatDistanceToNow(new Date(creado), { locale: es })}
              </p>
              <div className="botones">
                {/*
                <button
                  onClick={scrollToSection}
                  css={css`
                    background-color: var(--botones);
                    cursor: pointer;
                  `}
                >
                  Plano
                </button>
                */}

                {usuario && (
                  <>
                    {pase == false && estado && (
                      <button
                        onClick={handleNuevaInversion}
                        css={css`
                          background-color: ${totalCubos >= 100
                            ? "#ad86eb"
                            : "#9858ff"};

                          cursor: ${totalCubos >= 100
                            ? "not-allowed"
                            : "pointer"};
                          padding: 10px 20px;
                          font-size: 20px;
                          color: white;
                          border-radius: 10px;
                          text-align: center;
                          text-transform: uppercase;
                          margin-bottom: 10px;
                          font-weight: bold;
                        `}
                        disabled={totalCubos >= 100 || depositoRecaudado}
                      >
                        Invertir
                      </button>
                    )}

                    {/*

{estado &&
                      esCreador(usuario.uid) &&
                      totalCubos === 100 &&
                      depositoRecaudado == false && (
                        <button
                          onClick={handleRecaudado}
                          css={css`
                            background-color: var(--botones);
                            cursor: pointer;
                          `}
                        >
                          Depositar lo Recaudado
                        </button>
                      )}

                      */}

                    {estado && esCreador(usuario.uid) && totalCubos === 100 && (
                      <BotonDepositar
                        onClick={handleGanancia}
                        css={css`
                          background-color: var(--botones);
                          cursor: pointer;
                        `}
                      >
                        Finalizar Proyecto
                      </BotonDepositar>
                    )}
                  </>
                )}
              </div>
            </GeneralDescripcion>

            <ContenedorProducto>
              <div>
                {usuario && (
                  <Comentarios>
                    <form onSubmit={agregarComentario}>
                      <Campo>
                        <input
                          type="text"
                          name="mensaje"
                          value={inputComentario}
                          onChange={comentariosChange}
                          placeholder="Escribe tu comentario"
                        />
                      </Campo>
                      <div className="enviarComentario">
                        <input
                          type="submit"
                          value="Agregar Comentario"
                          css={css`
                            cursor: ${inputComentario.trim() === ""
                              ? "not-allowed"
                              : "pointer"};
                          `}
                        />
                      </div>
                    </form>
                  </Comentarios>
                )}

                <ListaComentarios>
                  <h2
                    css={css`
                      text-align: center;
                    `}
                  >
                    Comentarios
                  </h2>
                  {comentarios.length === 0 ? (
                    <p
                      css={css`
                        margin-bottom: 2rem;
                      `}
                    >
                      Aún no hay comentarios
                    </p>
                  ) : (
                    <ul>
                      {comentarios.map((comentario, i) => (
                        <ListaComentario
                          key={`${comentario.usuarioId}-${i}`}
                          css={css`
                            border: 1px solid #e1e1e1;
                            padding: 2rem;
                            margin-bottom: 2rem;
                            border-radius: 10px;
                            position: relative;
                            background-color: var(--colorBarraSuperior);
                          `}
                        >
                          {esCreador(comentario.usuarioId) && (
                            <CreadorProducto
                              css={css`
                                @media (max-width: 550px) {
                                  bottom: 5px;
                                  right: 5px;
                                  font-size: 10px;
                                  padding: 0.2rem 1rem;
                                }
                              `}
                            >
                              Es Creador
                            </CreadorProducto>
                          )}
                          <div className="contenedorPerfil">
                            <img
                              src={
                                comentario.icono != null
                                  ? comentario.icono
                                  : "/static/img/imagenPerfil.png"
                              }
                            />
                          </div>
                          <div
                            css={css`
                              margin-left: 10px;
                            `}
                          >
                            <p>{comentario.mensaje}</p>
                            <p>
                              Escrito por:
                              <span
                                css={css`
                                  font-weight: bold;
                                `}
                              >
                                {""} {comentario.usuarioNombre}
                              </span>
                            </p>
                            <Publicado>
                              Publicado hace :{" "}
                              {formatDistanceToNow(new Date(comentario.fecha), {
                                locale: es,
                              })}
                            </Publicado>
                          </div>
                        </ListaComentario>
                      ))}
                    </ul>
                  )}
                </ListaComentarios>
              </div>
              <aside>
                {/*
                <RutaWeb>
                  <a
                    target="_blank"
                    bgColor="true"
                    href={url}
                    css={css`
                      background-color: var(--grisBotones);
                      padding: 10px;
                      border-radius: 10px;
                      height: 100px;
                    `}
                  >
                    <img src="/static/img/ruta.png" />
                    <span>Visitar Web</span>
                  </a>
                  <div className="votarUsuario">
                    <div className="cantVotos">
                      <i className="bx bx-heart"></i>
                      <p>{votos}</p>
                    </div>
                    {usuario && (
                      <BotonVotar onClick={votarProducto}>Votar</BotonVotar>
                    )}
                  </div>
                </RutaWeb>

                */}

                <div
                  className="grupoInversores"
                  css={css`
                    padding: 30px;
                    border: 1px solid #e1e1e1;
                    margin-bottom: 20px;
                  `}
                >
                  <div
                    css={css`
                      width: 50%;
                      margin: 0 auto;
                      margin-top: 10px;
                      margin-bottom: 20px;
                    `}
                  >
                    <CircularProgressbar
                      value={totalCubos}
                      styles={buildStyles({
                        pathColor: totalCubos < 100 ? "#3B82F6" : "#DC2626",
                        textColor: totalCubos < 100 ? "#3B82F6" : "#DC2626",
                        trailColor: "#eee",
                        strokeLinecap: "butt",
                      })}
                      text={`${totalCubos}%`}
                    />
                  </div>
                  {inversores != undefined && inversores.length === 0 ? (
                    <p
                      css={css`
                        text-align: center;
                        font-weight: bold;
                        margin: 30px;
                      `}
                    >
                      Aún no hay inversores
                    </p>
                  ) : (
                    <>
                      <Precio
                        css={css`
                          text-align: center;
                        `}
                      >
                        <span>Total Recaudado: </span>{" "}
                        {formatearPresupuesto(
                          (parseInt(precio) * totalCubos) / 100
                        )}
                      </Precio>
                      <p
                        css={css`
                          font-weight: bold;
                          margin-bottom: 10px;
                        `}
                      >
                        Lista de Inversores{" "}
                      </p>
                      <ul
                        css={css`
                          .swipe-action__leading {
                            background-color: #3b82f6;
                            color: white;
                            margin-bottom: 20px;
                          }

                          .swipe-action__trailing {
                            background-color: #db2777;
                            color: white;
                            margin-bottom: 20px;
                          }

                          .swipeable-list .swipe-action {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            font-size: 2.4rem;
                            text-align: right;
                          }
                        `}
                      >
                        {inversores &&
                          inversores.map((inversor, i) => (
                            <div>
                              {esCreadorInversor(inversor.usuarioId) &&
                              estado &&
                              depositoRecaudado == false ? (
                                <SwipeableList>
                                  <SwipeableListItem
                                    leadingActions={leadingActions()}
                                    trailingActions={trailingActions()}
                                  >
                                    <ListaComentario
                                      key={`${inversor.usuarioId}-${i}`}
                                      css={css`
                                        border: 1px solid #e1e1e1;
                                        padding: 2rem;
                                        width: 100%;
                                        margin-bottom: 20px;
                                        background-color: var(
                                          --colorBarraSuperior
                                        );
                                        @media (max-width: 500px) {
                                          font-size: 10px;
                                          padding: 0.6rem;
                                        }
                                      `}
                                    >
                                      {esCreadorInversor(
                                        inversor.usuarioId
                                      ) && (
                                        <CreadorProducto
                                          css={css`
                                            @media (max-width: 550px) {
                                              font-size: 10px;
                                              padding: 0.2rem 1rem;
                                              height: 20px;
                                            }
                                          `}
                                        >
                                          Tu inversión
                                        </CreadorProducto>
                                      )}
                                      <div className="contenedorPerfil">
                                        <img
                                          src={
                                            inversor.icono != null
                                              ? inversor.icono
                                              : "/static/img/imagenPerfil.png"
                                          }
                                        />
                                      </div>

                                      <div
                                        css={css`
                                          margin-left: 10px;
                                          display: grid;
                                          grid-template-columns: 1fr 1fr;
                                          @media (max-width: 550px) {
                                            display: flex;
                                            flex-direction: column;
                                          }
                                        `}
                                      >
                                        <div>
                                          <p>
                                            Inversor:
                                            <span
                                              css={css`
                                                font-weight: bold;
                                              `}
                                            >
                                              {""} {inversor.usuarioNombre}
                                            </span>
                                          </p>

                                          <p>
                                            Descripción:
                                            <span
                                              css={css`
                                                font-weight: bold;
                                              `}
                                            >
                                              {""} {inversor.descripcion}
                                            </span>
                                          </p>

                                          <p>
                                            Categoria:
                                            <span
                                              css={css`
                                                font-weight: bold;
                                              `}
                                            >
                                              {""} {inversor.categoria}
                                            </span>
                                          </p>

                                          <Publicado>
                                            Publicado hace :{" "}
                                            {formatDistanceToNow(
                                              new Date(inversor.fecha),
                                              {
                                                locale: es,
                                              }
                                            )}
                                          </Publicado>
                                        </div>
                                        <div
                                          css={css`
                                            display: grid;
                                            grid-template-columns: 1fr 2fr;

                                            div {
                                              display: flex;
                                              align-items: center;
                                              justify-content: center;
                                              flex-direction: column;
                                              gap: 5px;
                                              div {
                                                display: flex;
                                                align-items: center;
                                                padding: 8px;
                                                border-radius: 6px;
                                                background-color: var(
                                                  --contBoton
                                                );
                                              }
                                            }
                                          `}
                                        >
                                          <div>
                                            <div
                                              css={css`
                                                background-color: #080809 !important;
                                              `}
                                            >
                                              <i class="bx bx-cube"></i>
                                              <span
                                                css={css`
                                                  font-weight: bold;
                                                  @media (max-width: 550px) {
                                                    font-size: 10px;
                                                  }
                                                `}
                                              >
                                                {inversor.cubos}
                                              </span>
                                            </div>
                                          </div>
                                          <div>
                                            <div
                                              css={css`
                                                background-color: #080809 !important;
                                              `}
                                            >
                                              <i class="bx bx-money-withdraw"></i>
                                              <span
                                                css={css`
                                                  font-weight: bold;
                                                  @media (max-width: 550px) {
                                                    font-size: 10px;
                                                  }
                                                `}
                                              >
                                                {""}{" "}
                                                {formatearPresupuesto(
                                                  (parseInt(precio) *
                                                    inversor.cubos) /
                                                    100
                                                )}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </ListaComentario>
                                  </SwipeableListItem>
                                </SwipeableList>
                              ) : (
                                <ListaComentario
                                  key={`${inversor.usuarioId}-${i}`}
                                  css={css`
                                    border: 1px solid #e1e1e1;
                                    padding: 2rem;
                                    width: 100%;
                                    margin-bottom: 20px;
                                    position: relative;
                                    background-color: var(--colorBarraSuperior);
                                  `}
                                >
                                  {esCreadorInversor(inversor.usuarioId) && (
                                    <div
                                      css={css`
                                        padding: 0.5rem 2rem;
                                        background-color: #da552f;
                                        color: #fff;
                                        position: absolute;
                                        right: 15px;
                                        bottom: 10px;
                                        text-transform: uppercase;
                                        font-weight: bold;
                                        @media (max-width: 550px) {
                                          font-size: 10px;
                                          padding: 0.2rem 1rem;
                                        }
                                      `}
                                    >
                                      Tu inversión
                                    </div>
                                  )}
                                  <div className="contenedorPerfil">
                                    <img
                                      src={
                                        inversor.icono != null
                                          ? inversor.icono
                                          : "/static/img/imagenPerfil.png"
                                      }
                                    />
                                  </div>
                                  <div
                                    css={css`
                                      margin-left: 10px;
                                      display: grid;
                                      grid-template-columns: 1fr 1fr;
                                      @media (max-width: 550px) {
                                        display: flex;
                                        flex-direction: column;
                                      }
                                    `}
                                  >
                                    <div>
                                      <p>
                                        Inversor:
                                        <span
                                          css={css`
                                            font-weight: bold;
                                          `}
                                        >
                                          {""} {inversor.usuarioNombre}
                                        </span>
                                      </p>

                                      <p>
                                        Descripción:
                                        <span
                                          css={css`
                                            font-weight: bold;
                                          `}
                                        >
                                          {""} {inversor.descripcion}
                                        </span>
                                      </p>

                                      <p>
                                        Categoria:
                                        <span
                                          css={css`
                                            font-weight: bold;
                                          `}
                                        >
                                          {""} {inversor.categoria}
                                        </span>
                                      </p>
                                      <Publicado>
                                        Publicado hace :{" "}
                                        {formatDistanceToNow(
                                          new Date(inversor.fecha),
                                          {
                                            locale: es,
                                          }
                                        )}
                                      </Publicado>
                                    </div>
                                    <div
                                      css={css`
                                        display: grid;
                                        grid-template-columns: 1fr 2fr;
                                        gap: 10px;

                                        div {
                                          display: flex;
                                          align-items: center;
                                          justify-content: center;
                                          flex-direction: column;
                                          gap: 5px;
                                          div {
                                            display: flex;
                                            align-items: center;
                                            padding: 8px;
                                            border-radius: 6px;
                                            background-color: var(--contBoton);
                                          }
                                        }
                                      `}
                                    >
                                      <div>
                                        <div
                                          css={css`
                                            background-color: #080809 !important;
                                          `}
                                        >
                                          <i class="bx bx-cube"></i>
                                          <span
                                            css={css`
                                              font-weight: bold;
                                              @media (max-width: 550px) {
                                                font-size: 10px;
                                              }
                                            `}
                                          >
                                            {inversor.cubos}
                                          </span>
                                        </div>
                                      </div>
                                      <div>
                                        <div
                                          css={css`
                                            background-color: #080809 !important;
                                          `}
                                        >
                                          <i class="bx bx-money-withdraw"></i>
                                          <span
                                            css={css`
                                              font-weight: bold;
                                              @media (max-width: 550px) {
                                                font-size: 10px;
                                              }
                                            `}
                                          >
                                            {""}{" "}
                                            {formatearPresupuesto(
                                              (parseInt(precio) *
                                                inversor.cubos) /
                                                100
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </ListaComentario>
                              )}
                            </div>
                          ))}
                      </ul>
                    </>
                  )}
                </div>
              </aside>
            </ContenedorProducto>
            <Mapa id="mapaProducto">
              <MapPage cordenadas={cordenadas} />
            </Mapa>
            {puedeBorrar() && (
              <Boton onClick={eliminarProducto}>Eliminar Producto</Boton>
            )}
          </div>
        )}
      </>
    </Layout>
  );
};

export default Producto;
