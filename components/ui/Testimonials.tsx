'use client';

import { FaStar, FaQuoteLeft } from 'react-icons/fa';

interface Testimonio {
    id: number;
    nombre: string;
    rol: string;
    foto: string;
    texto: string;
    rating: number;
    roi: string;
    proyecto: string;
}

const testimonios: Testimonio[] = [
    {
        id: 1,
        nombre: 'Carlos Mendoza',
        rol: 'Inversor Verificado',
        foto: '/static/img/imagenPerfil.png',
        texto: 'Excelente plataforma para invertir. He obtenido retornos consistentes y el proceso es muy transparente. La comunicación con los creadores de proyectos es directa y efectiva.',
        rating: 5,
        roi: '+18%',
        proyecto: 'Edificio Los Álamos',
    },
    {
        id: 2,
        nombre: 'María Fernández',
        rol: 'Inversora Premium',
        foto: '/static/img/woman.jpg',
        texto: 'InversionesPro me ha permitido diversificar mi portafolio. La seguridad y confianza que transmiten es incomparable. He invertido en 5 proyectos y todos han sido exitosos.',
        rating: 5,
        roi: '+22%',
        proyecto: 'Centro Comercial Plaza',
    },
    {
        id: 3,
        nombre: 'Roberto Sánchez',
        rol: 'Inversor Empresarial',
        foto: '/static/img/imagenPerfil.png',
        texto: 'Como empresario, valoró la eficiencia y transparencia. Los proyectos están bien estructurados y la plataforma facilita todo el proceso de inversión. Altamente recomendado.',
        rating: 5,
        roi: '+15%',
        proyecto: 'Complejo Residencial Vista Mar',
    },
    {
        id: 4,
        nombre: 'Ana Torres',
        rol: 'Inversora Estratégica',
        foto: '/static/img/woman.jpg',
        texto: 'Llevo 2 años invirtiendo aquí y cada proyecto ha superado mis expectativas. El equipo de soporte es excelente y siempre están disponibles para resolver dudas.',
        rating: 5,
        roi: '+20%',
        proyecto: 'Torres del Sol',
    },
];

export default function Testimonials() {
    return (
        <section className="py-20 relative overflow-hidden">
            {/* Background decorativo */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-purple-900/10 to-slate-900" />
            
            <div className="max-w-7xl mx-auto px-4 relative">
                {/* Header */}
                <div className="text-center mb-16">
                    <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
                        💬 Lo que dicen nuestros{' '}
                        <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            Inversores
                        </span>
                    </h2>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                        Testimonios reales de inversores que han confiado en nuestra plataforma
                    </p>
                </div>

                {/* Grid de testimonios */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                    {testimonios.map((testimonio, index) => (
                        <article
                            key={testimonio.id}
                            className="relative p-8 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 shadow-2xl hover:shadow-blue-500/20 hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300"
                        >
                            {/* Icono de comillas */}
                            <div className="absolute top-6 right-6 text-blue-500/20">
                                <FaQuoteLeft size={40} />
                            </div>

                            {/* Header con foto y datos */}
                            <div className="flex items-start gap-4 mb-6">
                                <div className="flex-shrink-0 hover:scale-110 hover:rotate-3 transition-transform duration-300">
                                    <img
                                        src={testimonio.foto}
                                        alt={testimonio.nombre}
                                        className="w-16 h-16 rounded-full object-cover border-2 border-blue-500/50"
                                    />
                                </div>

                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-white mb-1">
                                        {testimonio.nombre}
                                    </h3>
                                    <p className="text-sm text-blue-400 font-semibold mb-2">
                                        {testimonio.rol}
                                    </p>
                                    {/* Rating */}
                                    <div className="flex items-center gap-1">
                                        {[...Array(testimonio.rating)].map((_, i) => (
                                            <FaStar key={i} className="text-yellow-400" size={14} />
                                        ))}
                                    </div>
                                </div>

                                {/* ROI Badge */}
                                <div className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full">
                                    <span className="text-white font-bold text-sm">
                                        {testimonio.roi}
                                    </span>
                                </div>
                            </div>

                            {/* Texto del testimonio */}
                            <p className="text-slate-300 leading-relaxed mb-6 relative z-10">
                                "{testimonio.texto}"
                            </p>

                            {/* Footer con proyecto */}
                            <div className="pt-4 border-t border-white/10">
                                <p className="text-sm text-slate-400">
                                    Proyecto:{' '}
                                    <span className="text-blue-400 font-semibold">
                                        {testimonio.proyecto}
                                    </span>
                                </p>
                            </div>
                        </article>
                    ))}
                </div>

                {/* CTA */}
                <div className="text-center mt-12">
                    <p className="text-slate-400 mb-4">
                        Únete a más de <span className="text-blue-400 font-bold">1,200+ inversores</span> satisfechos
                    </p>
                    <a
                        href="/crear-cuenta"
                        className="inline-block px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:scale-105 active:scale-95 transition-all duration-200"
                    >
                        Comienza a Invertir Hoy
                    </a>
                </div>
            </div>
        </section>
    );
}
