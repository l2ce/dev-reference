import type { NextConfig } from 'next'
import type { Configuration } from 'webpack'
import { siteConfig } from './src/infra/site-config/index'

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: siteConfig.basePath,
  images: { unoptimized: true },
  serverExternalPackages: ['@l2ce/database', '@l2ce/core', 'better-sqlite3'],
  experimental: { globalNotFound: true },
  /**
   * Сохраняет нативные workspace-пакеты вне bundle: обычный external matcher
   * Next.js 16 проверяет node_modules, но pnpm symlinks разрешаются в packages/.
   */
  webpack(config: Configuration, { isServer }): Configuration {
    if (isServer) {
      const externals = config.externals ?? []
      config.externals = [
        ...(Array.isArray(externals) ? externals : [externals]),
        {
          '@l2ce/database': 'commonjs @l2ce/database',
          '@l2ce/core/reference': 'commonjs @l2ce/core/reference',
          '@l2ce/core/markdown': 'commonjs @l2ce/core/markdown'
        }
      ]
    }
    return config
  }
}

export default nextConfig
