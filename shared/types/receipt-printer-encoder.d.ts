declare module '@point-of-sale/receipt-printer-encoder' {
  export interface ReceiptPrinterEncoderOptions {
    columns?: number
    language?: 'esc-pos' | 'star-line' | 'star-prnt'
    printerModel?: string
    codepageMapping?: string
    feedBeforeCut?: number
    newline?: string
    imageMode?: 'column' | 'raster'
  }

  export interface TableColumn {
    width?: number
    marginLeft?: number
    marginRight?: number
    align?: 'left' | 'right'
  }

  export default class ReceiptPrinterEncoder {
    constructor(options?: ReceiptPrinterEncoderOptions)
    initialize(): this
    codepage(codepage: string): this
    text(value: string): this
    line(value?: string): this
    newline(count?: number): this
    bold(state?: boolean): this
    underline(state?: boolean): this
    invert(state?: boolean): this
    align(alignment: 'left' | 'center' | 'right'): this
    size(width: number, height?: number): this
    font(font: string): this
    rule(options?: { style?: 'single' | 'double' | 'dashed', width?: number }): this
    table(columns: TableColumn[], rows: string[][]): this
    cut(type?: 'full' | 'partial'): this
    encode(): Uint8Array
  }
}
