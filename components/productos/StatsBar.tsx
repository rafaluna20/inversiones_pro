'use client';


interface StatsBarProps {
    votos: number;
    comentarios: number;
    inversores: number;
    ubicacion?: string;
}

export default function StatsBar({ votos, comentarios, inversores, ubicacion }: StatsBarProps) {
    const stats = [
        { icon: 'bx-heart', label: 'Votos', value: votos, color: 'text-red-400' },
        { icon: 'bx-comment-dots', label: 'Comentarios', value: comentarios, color: 'text-blue-400' },
        { icon: 'bx-group', label: 'Inversores', value: inversores, color: 'text-purple-400' },
    ];

    return (
        <div className="flex flex-wrap items-center gap-4 lg:gap-6 p-4 bg-slate-900/30 border border-white/5 rounded-xl">
            {stats.map((stat, index) => (
                <div
                    key={stat.label}
                    className="flex items-center gap-2"
                >
                    <i className={`bx ${stat.icon} text-xl ${stat.color}`}></i>
                    <div>
                        <p className="text-xs text-gray-500">{stat.label}</p>
                        <p className="text-lg font-bold text-white">{stat.value}</p>
                    </div>
                </div>
            ))}

            {ubicacion && (
                <div
                    className="flex items-center gap-2 ml-auto"
                >
                    <i className="bx bx-map text-xl text-green-400"></i>
                    <div>
                        <p className="text-xs text-gray-500">Ubicación</p>
                        <p className="text-sm font-semibold text-white">{ubicacion}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
