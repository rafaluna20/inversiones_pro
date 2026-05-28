import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nosotros - Inversiones Pro',
  description: 'Conoce más sobre nuestra plataforma de inversiones inmobiliarias',
};

export default function NosotrosPage() {
  return (
    <div className="min-h-screen bg-[var(--contCard)]">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-[#1e3a8a] to-[#0f172a] text-white py-24 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Cada propiedad tiene una historia
          </h1>
          <p className="text-xl md:text-2xl text-gray-100">
            ¡Hagamos que la tuya comience aquí!
          </p>
        </div>
      </section>

      {/* Navigation */}
      <nav className="bg-[#1e2229] border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-center space-x-8 py-4">
            <a href="#inicio" className="text-gray-300 hover:text-blue-500 font-medium font-roboto-slab">Inicio</a>
            <a href="#servicio" className="text-gray-300 hover:text-blue-500 font-medium font-roboto-slab">Servicio</a>
            <a href="#portafolio" className="text-gray-300 hover:text-blue-500 font-medium font-roboto-slab">Portafolio</a>
            <a href="#expertos" className="text-gray-300 hover:text-blue-500 font-medium font-roboto-slab">Expertos</a>
            <a href="#contacto" className="text-gray-300 hover:text-blue-500 font-medium font-roboto-slab">Contacto</a>
          </div>
        </div>
      </nav>

      {/* Services */}
      <section id="servicio" className="py-20 bg-[var(--contCard)]">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16 text-white font-roboto-slab">
            Nuestro Servicio
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <img
                src="/static/img/future.png"
                alt="Inversiones Pro Logo"
                className="w-full max-w-md mx-auto"
              />
            </div>

            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                  1
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2 text-white font-roboto-slab">Venta de Propiedades</h3>
                  <p className="text-gray-400">
                    Conectamos inversionistas con oportunidades inmobiliarias verificadas
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                  2
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2 text-white font-roboto-slab">Inversión Colectiva</h3>
                  <p className="text-gray-400">
                    Participa en proyectos inmobiliarios desde montos accesibles
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                  3
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2 text-white font-roboto-slab">Asesoría Profesional</h3>
                  <p className="text-gray-400">
                    Equipo experto te guía en cada decisión de inversión
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Portfolio */}
      <section id="portafolio" className="py-20 bg-[#13161c]">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4 text-gray-800">
            Portafolio
          </h2>
          <p className="text-center text-gray-600 mb-16 text-lg">
            Proyectos exitosos que han transformado vidas
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card overflow-hidden group cursor-pointer bg-[#1e2229] border-gray-700">
              <img
                src="/static/img/nosotros1.webp"
                alt="Proyecto 1"
                className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2 text-white font-roboto-slab">Edificio Miraflores</h3>
                <p className="text-gray-400">Proyecto residencial completado</p>
              </div>
            </div>

            <div className="card overflow-hidden group cursor-pointer">
              <img
                src="/static/img/nosotros2.jpg"
                alt="Proyecto 2"
                className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2 text-white font-roboto-slab">Complejo San Isidro</h3>
                <p className="text-gray-400">Inversión comercial exitosa</p>
              </div>
            </div>

            <div className="card overflow-hidden group cursor-pointer">
              <img
                src="/static/img/nosotros3.jpg"
                alt="Proyecto 3"
                className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2 text-white font-roboto-slab">Residencial Surco</h3>
                <p className="text-gray-400">Desarrollo habitacional</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section id="expertos" className="py-20 bg-[var(--contCard)]">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4 text-gray-800">
            Nuestros Expertos
          </h2>
          <p className="text-center text-gray-600 mb-16 text-lg">
            Profesionales con años de experiencia en el sector inmobiliario
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center">
                <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full"></div>
                <h3 className="font-semibold text-lg mb-1 text-white font-roboto-slab">Experto {i}</h3>
                <p className="text-gray-400 text-sm">Especialista Inmobiliario</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contacto" className="py-20 bg-gradient-to-br from-blue-900 to-purple-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">¿Listo para invertir?</h2>
          <p className="text-xl mb-8">
            Contáctanos y comienza tu camino hacia la libertad financiera
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/crear-cuenta"
              className="bg-white text-blue-900 px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition"
            >
              Crear Cuenta
            </Link>
            <Link
              href="/"
              className="border-2 border-white px-8 py-4 rounded-lg font-semibold hover:bg-white/10 transition"
            >
              Ver Proyectos
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
