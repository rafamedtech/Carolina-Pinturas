// Match dropdown options to the action menus while keeping the full-size trigger.
const selectTypography = {
  variants: {
    size: {
      xl: {
        item: 'text-sm',
        empty: 'text-sm'
      }
    }
  }
}

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'zinc'
    },
    dashboardNavbar: {
      slots: {
        title: 'text-base'
      }
    },
    navigationMenu: {
      slots: {
        link: 'text-sm',
        childLink: 'text-sm'
      }
    },
    tabs: {
      defaultVariants: {
        size: 'md'
      }
    },
    dropdownMenu: {
      defaultVariants: {
        size: 'md'
      }
    },
    button: {
      variants: {
        size: {
          sm: { base: 'text-sm/4' }
        }
      }
    },
    badge: {
      defaultVariants: {
        size: 'md'
      },
      variants: {
        size: {
          xs: { base: 'text-xs' },
          sm: { base: 'text-xs' }
        }
      }
    },
    inputMenu: selectTypography,
    select: selectTypography,
    selectMenu: selectTypography,
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
