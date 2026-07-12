/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Necesario para el build de Docker (standalone reduce el tamaño de la imagen).
  output: 'standalone',
  // Transpila los paquetes del monorepo consumidos como código fuente.
  transpilePackages: ['@nab/ui', '@nab/shared'],
  eslint: {
    // El lint se corre como paso separado en CI.
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // Los paquetes del monorepo usan resolución NodeNext (imports con .js).
    // Esto permite a webpack resolver './plans.js' → './plans.ts'.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
