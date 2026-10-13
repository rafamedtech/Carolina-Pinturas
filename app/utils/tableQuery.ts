import { parseDate } from '@internationalized/date'
import type { SortingState } from '@tanstack/table-core'
import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import type { Ref } from 'vue'
import type { OrderDateRange } from '~/types/orders'

export interface TableQueryBinding {
  read: (query: LocationQuery) => void
  write: () => LocationQueryRaw
}

export interface TableQueryCodec<T> {
  parse: (value: unknown) => T
  serialize: (value: T) => string | undefined
}

export function tableQueryText(defaultValue = '', values?: readonly string[]): TableQueryCodec<string> {
  return {
    parse: value => typeof value === 'string' && (!values || values.includes(value)) ? value : defaultValue,
    serialize: value => value === defaultValue ? undefined : value
  }
}

export const tableQueryPage: TableQueryCodec<number> = {
  parse: (value) => {
    const page = typeof value === 'string' ? Number(value) : NaN
    return Number.isSafeInteger(page) && page > 0 ? page : 1
  },
  serialize: value => value > 1 ? String(value) : undefined
}

export const tableQueryBoolean: TableQueryCodec<boolean> = {
  parse: value => value === 'true' || value === '1',
  serialize: value => value ? 'true' : undefined
}

export const tableQueryDate: TableQueryCodec<string> = {
  parse: (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
    try {
      return parseDate(value).toString()
    } catch {
      return ''
    }
  },
  serialize: value => value || undefined
}

export const tableQuerySorting: TableQueryCodec<SortingState> = {
  parse: (value) => {
    if (typeof value !== 'string') return []
    return value.split(',').flatMap((item) => {
      const match = /^([\w]+):(asc|desc)$/.exec(item)
      return match ? [{ id: match[1]!, desc: match[2] === 'desc' }] : []
    })
  },
  serialize: value => value.length ? value.map(item => `${item.id}:${item.desc ? 'desc' : 'asc'}`).join(',') : undefined
}

export function tableQueryField<T>(key: string, state: Ref<T>, codec: TableQueryCodec<T>): TableQueryBinding {
  return {
    read: (query) => {
      const value = codec.parse(query[key])
      if (codec.serialize(state.value) !== codec.serialize(value)) state.value = value
    },
    write: () => ({ [key]: codec.serialize(state.value) })
  }
}

export function tableQueryRange(state: Ref<OrderDateRange | null>, from = 'date_from', to = 'date_to'): TableQueryBinding {
  return {
    read: (query) => {
      const start = tableQueryDate.parse(query[from])
      const end = tableQueryDate.parse(query[to])
      const value = start && end && start <= end ? { start: parseDate(start), end: parseDate(end) } : null
      if (state.value?.start?.toString() !== value?.start.toString() || state.value?.end?.toString() !== value?.end.toString()) state.value = value
    },
    write: () => ({
      [from]: state.value?.start && state.value?.end ? state.value.start.toString() : undefined,
      [to]: state.value?.start && state.value?.end ? state.value.end.toString() : undefined
    })
  }
}

export function tableReturnPath(value: unknown, fallback: string, allowed = [fallback]) {
  if (typeof value !== 'string' || value.includes('\\')) return fallback
  return allowed.some(path => value === path || value.startsWith(`${path}?`)) ? value : fallback
}
