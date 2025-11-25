import React, { useState, useMemo, useRef } from "react"; 
import { useNavigate } from "react-router-dom";
import type { Voto } from "../../types";
import type { CategoriaId } from "./VoteNavbar";

import VoteNavbar from "./VoteNavbar";
import VoteSection from "./VoteSection";
import axios from 'axios'; 

import CandidatoModal from "./CandidatoModal.tsx"; 
import {
    getUsuarioPorDni,
    saveVoto,
    partidosSimulados,
    checkIfDniVotedAllCategories,
    type CandidatoInfo,
} from "../../services/mockData"; // <-- Usamos esta función

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// ------------------------------------------------------------------
// 🎯 NUEVA URL DE PRODUCCIÓN DE RAILWAY
// La ruta base de tu API en Railway.
// ------------------------------------------------------------------
const API_BASE_URL = "https://votaciones-backend-production.up.railway.app";
// ------------------------------------------------------------------

interface DatosReniec {
    dni: string;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    departamento: string; 
    fechaNacimiento: string; 
}

const Icon = ({ className, color }: { className: string, color: string }) => (
    <i className={`bi ${className} me-2`} style={{ fontSize: '1.25rem', color: color }}></i>
);

const ICON_COLORS = {
    success: '#6cbe6c',
    error: '#d9534f',
    info: '#5bc0de',
};

type PartidoConCandidatoLocal = {
    nombre: string;
    logo: string;
    candidato?: CandidatoInfo;
};

type VotingStep = "DNI_CONFIRMATION" | "VOTING_SELECTION";

export default function VoteForm() {
    const navigate = useNavigate();
    const [dni, setDni] = useState("");
    const [nombres, setNombres] = useState("");
    const [apellidos, setApellidos] = useState("");
    const [departamento, setDepartamento] = useState("");
    
    const [correctFechaNacimiento, setCorrectFechaNacimiento] = useState<string | null>(null); 
    const [userFechaNacimiento, setUserFechaNacimiento] = useState(""); 
    const [isLoadingDni, setIsLoadingDni] = useState(false);

    const [categoriaActual, setCategoriaActual] =
        useState<CategoriaId>("presidencial");
    const [votoFinalizado, setVotoFinalizado] = useState(false);
    const [currentStep, setCurrentStep] = useState<VotingStep>("DNI_CONFIRMATION");
    const [categoriasVotadas, setCategoriasVotadas] = useState<CategoriaId[]>([]); 

    const [selecciones, setSelecciones] = useState<Record<CategoriaId, string | null>>({
        presidencial: null,
        congreso: null,
        parlamento: null,
    });

    const [submitting, setSubmitting] = useState(false);
    const [datosConfirmados, setDatosConfirmados] = useState(false);

    const navbarRef = useRef<HTMLDivElement>(null); 

    // MODAL
    const [showModal, setShowModal] = useState(false);
    const [candidatoModal, setCandidatoModal] = useState<CandidatoInfo | null>(null);
    const [nombrePartidoModal, setNombrePartidoModal] = useState(""); 

    const handleShowDetails = (
        candidato: CandidatoInfo, 
        logoUrl: string, 
        categoria: CategoriaId,
        nombrePartido: string
    ) => {
        setCandidatoModal(candidato);
        setNombrePartidoModal(nombrePartido);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setCandidatoModal(null);
        setNombrePartidoModal("");
    };

    const partidosPorCategoria = useMemo(() => {
        const categorias: CategoriaId[] = ["presidencial", "congreso", "parlamento"];
        
        const obj = {} as Record<CategoriaId, PartidoConCandidatoLocal[]>;
        categorias.forEach((cat) => {
            obj[cat] = partidosSimulados.map((p) => ({
                nombre: p.nombre,
                logo: p.logo,
                candidato: p.candidatos[cat], 
            }));
        });
        return obj;
    }, []);

    const handleDniChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const numericValue = value.replace(/\D/g, ''); 
        const finalValue = numericValue.slice(0, 8); 
        setDni(finalValue);

        setVotoFinalizado(false); 
        setDatosConfirmados(false);
        setCurrentStep("DNI_CONFIRMATION"); 
        setNombres(""); setApellidos(""); setDepartamento("");
        setCategoriasVotadas([]);
        setCorrectFechaNacimiento(null);
        setUserFechaNacimiento(""); 
    };

// 👇 FUNCIÓN MODIFICADA: Se reemplaza 'http://localhost:8080' por la variable API_BASE_URL.
const handleBuscar = async () => {
    setDatosConfirmados(false);
    setVotoFinalizado(false);
    setCurrentStep("DNI_CONFIRMATION"); 
    setCategoriasVotadas([]);
    setCorrectFechaNacimiento(null); 
    setUserFechaNacimiento(""); 
    setIsLoadingDni(true); 
    setNombres(""); setApellidos(""); setDepartamento(""); 

    if (dni.length !== 8) {
        toast.error("El DNI debe tener exactamente 8 dígitos.", { 
            icon: <Icon className="bi-exclamation-octagon-fill" color={ICON_COLORS.error} /> 
        });
        setIsLoadingDni(false);
        return;
    }

    // *****************************************************************
    // 1. VERIFICACIÓN DE VOTO COMPLETO (Bloqueo al buscar)
    // *****************************************************************
    try {
        // Usamos la función mock importada para chequear el estado de votación.
        const yaVoto = checkIfDniVotedAllCategories(dni.trim()); 
        
        if (yaVoto) {
            // Cargamos datos del mock para mostrar el nombre en el mensaje de bloqueo.
            const usuarioMock = getUsuarioPorDni(dni.trim());
            setNombres(usuarioMock?.nombres || "Usuario");
            setApellidos(usuarioMock ? `${usuarioMock.apellidos}` : "Registrado");
            setDepartamento(usuarioMock?.departamento || "N/A");

            setVotoFinalizado(true); // Activa el mensaje de bloqueo en el render
            setDatosConfirmados(false); // Asegura que no se puede avanzar
            setCurrentStep("DNI_CONFIRMATION"); // Mantiene la vista de confirmación
            
            toast.error("Este DNI ya ha completado su votación. No puede volver a votar.", { 
                icon: <Icon className="bi-exclamation-octagon-fill" color={ICON_COLORS.error} /> 
            });
            setIsLoadingDni(false);
            return; // 🛑 BLOQUEO INMEDIATO: Sale de la función aquí.
        }

    } catch (error) {
        // En caso de que la verificación local/mock falle, solo advertimos y continuamos con la API.
        console.warn("Advertencia: Fallo en la verificación local de voto, continuando con la búsqueda de datos.", error);
    }
    // *****************************************************************
    // 2. BÚSQUEDA DE DATOS DE RENIEC (Lógica original del usuario si NO ha votado)
    // *****************************************************************

    try {
        // ----------------------------------------------------------------------------------
        // ⭐ CAMBIO CLAVE: Usamos la URL de Railway para la llamada a la API
        // ----------------------------------------------------------------------------------
        const response = await axios.get(
            `${API_BASE_URL}/api/votos/consulta-dni/${dni.trim()}`
        );

        const datos = response.data;

        setNombres(datos.first_name || "");
        setApellidos(`${datos.first_last_name} ${datos.second_last_name}`.trim());
        
        setDepartamento(datos.departamento || "");
        setCorrectFechaNacimiento(datos.fechaNacimiento || "");

        toast.info("Datos cargados. Ingrese su Fecha de Nacimiento.", { 
            icon: <Icon className="bi-info-circle-fill" color={ICON_COLORS.info} /> 
        });

    } catch (error) {
        toast.error("DNI no encontrado en RENIEC. La API está en producción, pero no devolvió datos.", { 
            icon: <Icon className="bi-exclamation-octagon-fill" color={ICON_COLORS.error} /> 
        });

        setNombres(""); 
        setApellidos(""); 
        setDepartamento("");
        setCorrectFechaNacimiento(null);
    } finally {
        setIsLoadingDni(false);
    }
};

    const handleConfirmarDatos = () => {
        if (votoFinalizado) return; 

        // Solo validar que los datos hayan sido cargados (nombres/apellidos).
        if (!nombres || !apellidos) {
            toast.error("Busque su DNI antes de confirmar.", { 
                icon: <Icon className="bi-exclamation-octagon-fill" color={ICON_COLORS.error} /> 
            });
            return;
        }

        // Como tu backend no devuelve fecha de nacimiento, no la validamos.
        setDatosConfirmados(true);
        setCurrentStep("VOTING_SELECTION");
        
        toast.success(`Bienvenido, ${nombres}. Inicie su votación.`, { 
            icon: <Icon className="bi-check-circle-fill" color={ICON_COLORS.success} /> 
        });

        if (navbarRef.current) {
            navbarRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleSelectPartido = (nombre: string) => {
        if (votoFinalizado || !datosConfirmados) return; 
        setSelecciones((s) => ({ ...s, [categoriaActual]: nombre }));
    };

    const handleConfirmVoto = async () => {
        if (votoFinalizado) return; 

        if (!dni || dni.length !== 8) {
            toast.error("Confirme su DNI antes de votar.", { 
                icon: <Icon className="bi-exclamation-octagon-fill" color={ICON_COLORS.error} /> 
            });
            return;
        }
        if (!datosConfirmados) {
            toast.error("Confirme sus datos primero.", { 
                icon: <Icon className="bi-exclamation-octagon-fill" color={ICON_COLORS.error} /> 
            });
            return;
        }

        const partidoSeleccionado = selecciones[categoriaActual];
        if (!partidoSeleccionado) {
            toast.error("Seleccione un partido.", { 
                icon: <Icon className="bi-exclamation-octagon-fill" color={ICON_COLORS.error} /> 
            });
            return;
        }

        setSubmitting(true);
        
        const partidoInfo = partidosPorCategoria[categoriaActual].find(
            (p) => p.nombre === partidoSeleccionado
        );

        const voto: Voto = {
            dni: dni.trim(),
            nombres: nombres, 
            apellidos: apellidos, 
            categoria: categoriaActual,
            partido: partidoSeleccionado,
            candidato: partidoInfo?.candidato?.nombre || "Sin candidato", 
            region: departamento, 
        };

        const exito = saveVoto(voto); 
        setSubmitting(false);

        if (exito) {
            window.dispatchEvent(new Event('votoRegistrado')); 

            setCategoriasVotadas((prev) => [...prev, categoriaActual]);
            setSelecciones((prev) => ({ ...prev, [categoriaActual]: null })); 
            
            const orden: CategoriaId[] = ["presidencial", "congreso", "parlamento"];
            
            const categoriasRestantes = orden.filter(
                (cat) => !categoriasVotadas.includes(cat) && cat !== categoriaActual
            ) as CategoriaId[];

            if (categoriasRestantes.length > 0) {
                const nextCategoria = categoriasRestantes[0];
                setCategoriaActual(nextCategoria);
                
                toast.success(
                    `Voto en ${categoriaActual.toUpperCase()} registrado. Continuando con ${nextCategoria.toUpperCase()}.`, 
                { 
                    icon: <Icon className="bi-check-circle-fill" color={ICON_COLORS.success} /> 
                });

                if (navbarRef.current) {
                    navbarRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

            } else {
                toast.success("Has completado las 3 votaciones.", { 
                    icon: <Icon className="bi-check-circle-fill" color={ICON_COLORS.success} /> 
                });
                setVotoFinalizado(true); 
                setTimeout(() => navigate("/"), 1800); 
            }
        } else {
            toast.error("Ya votó en esta categoría.", { 
                icon: <Icon className="bi-exclamation-octagon-fill" color={ICON_COLORS.error} /> 
            });
        }
    };

    const renderDniConfirmationSection = () => (
        <div className="card p-4 border-0 shadow-sm mb-4">
            <div className="row mb-3">
                <div className="col-md-8">
                    <label className="form-label fw-semibold">DNI (8 dígitos)</label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Ingrese su DNI"
                        value={dni ?? ""}
                        onChange={handleDniChange} 
                        inputMode="numeric"
                        pattern="\d{8}"
                        maxLength={8}
                        disabled={votoFinalizado || isLoadingDni}
                    />
                </div>
                <div className="col-md-4 d-flex align-items-end">
                    <button 
                        className="btn btn-primary w-100 fw-semibold" 
                        onClick={handleBuscar}
                        disabled={votoFinalizado || dni.length !== 8 || isLoadingDni} 
                    >
                        {isLoadingDni ? "Buscando..." : "Buscar"}
                    </button>
                </div>
            </div>

            <div className="row mb-3">
                <div className="col-md-6">
                    <label className="form-label fw-semibold">Nombres</label>
                    <input className="form-control" value={nombres ?? ""} readOnly />

                    <label className="form-label fw-semibold mt-3">Departamento</label>
                    <input 
                        className="form-control" 
                        value={departamento ?? ""} 
                        onChange={(e) => setDepartamento(e.target.value)}
                    />
                </div>
                <div className="col-md-6">
                    <label className="form-label fw-semibold">Apellidos</label>
                    <input className="form-control" value={apellidos ?? ""} readOnly />
                    
                    <label className="form-label fw-semibold mt-3">Fecha de Nacimiento</label>
                    <input 
                        type="date" 
                        className="form-control"
                        value={userFechaNacimiento ?? ""}
                        onChange={(e) => setUserFechaNacimiento(e.target.value)}
                        disabled={datosConfirmados || votoFinalizado} 
                    />
                </div>
            </div>

            {nombres && apellidos && !datosConfirmados && !votoFinalizado && (
                <div className="text-center mb-3 mt-4 border-top pt-3">
                    <button 
                        className="btn btn-success px-4 fw-semibold" 
                        onClick={handleConfirmarDatos}
                        disabled={!nombres || !apellidos || votoFinalizado}
                    >
                        Confirmar y Verificar Datos
                    </button>
                </div>
            )}

            {votoFinalizado && (
                <div className="alert alert-danger text-center fw-bold mt-4" role="alert">
                    ¡Este DNI ya ha completado su votación!
                </div>
            )}
        </div>
    );

    const renderVotingSection = () => (
        <>
            <div ref={navbarRef}> 
                <VoteNavbar 
                    current={categoriaActual}
                    onSelect={setCategoriaActual}
                    disabled={votoFinalizado}
                    categoriasVotadas={categoriasVotadas} 
                />
            </div>
            <div className="card p-3 border-0 shadow-sm mb-4">
                <VoteSection
                    categoria={categoriaActual}
                    partidos={partidosPorCategoria[categoriaActual]}
                    selected={selecciones[categoriaActual] ?? null}
                    onSelect={handleSelectPartido}
                    onVotar={handleConfirmVoto}
                    submitting={submitting}
                    datosConfirmados={datosConfirmados && !votoFinalizado} 
                    onShowDetails={handleShowDetails} 
                />
            </div>
        </>
    );

    return (
        <div className="container mt-5" style={{ maxWidth: 980 }}>
            <h2 className="text-center fw-bold mb-4 text-primary">
                Boleta de Votación Electrónica
            </h2>

            {currentStep === "DNI_CONFIRMATION" && renderDniConfirmationSection()}
            {currentStep === "VOTING_SELECTION" && renderVotingSection()}

            {showModal && candidatoModal && (() => {
                const logoUrl = partidosPorCategoria[categoriaActual].find(
                    (p) => p.candidato?.nombre === candidatoModal.nombre 
                )?.logo || ""; 

                return (
                    <CandidatoModal
                        candidato={candidatoModal} 
                        show={showModal}
                        onClose={handleCloseModal}
                        logoPartidoUrl={logoUrl} 
                        categoria={categoriaActual}
                        nombrePartido={nombrePartidoModal}
                    />
                );
            })()}

            <ToastContainer
                position="top-right"
                autoClose={2000}
                hideProgressBar={true} 
                newestOnTop
                closeOnClick
                pauseOnHover
                draggable
                theme="light" 
            />
        </div>
    );
}