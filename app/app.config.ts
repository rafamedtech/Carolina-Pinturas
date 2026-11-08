export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'zinc'
    },
    pageCard: {
      variants: {
        variant: {
          outline: { root: 'bg-card' },
          soft: { root: 'bg-card' },
          subtle: { root: 'bg-card' }
        }
      }
    }
  }
})
