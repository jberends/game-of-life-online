export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  ssr: false,
  devServer: {
    host: '0.0.0.0',
    port: 3000
  }
})