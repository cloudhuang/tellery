import isUrl from 'is-url'
import Papa from 'papaparse'
import type { Data } from 'components/v11n/types'
import { formatRecord } from 'components/v11n/utils'
import { QueryClient } from 'react-query'
export const DRAG_HANDLE_WIDTH = 4
export const test = 1

export enum TELLERY_MIME_TYPES {
  BLOCKS = 'text/tellery-blocks-v1',
  BLOCK_REF = 'text/tellery-block-ref-v1',
  TOKEN = 'text/tellery-tokens-v1',
  MONACO = 'vscode-editor-data'
}

export const DEFAULT_TITLE = 'Untitled'
export const FIRST_LINE_OR_LAST_LINE_THERESHOLD = 10
export const WS_URI = (import.meta.env.VITE_WS_URI as string) ?? '/workspace'

export const fileLoader = ({ src }: { src: string }) => {
  return `${src}`
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // suspense: true,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchIntervalInBackground: false,
      refetchInterval: false
    }
  }
})
export function snapshotToCSV(snpshot: Data) {
  console.log(snpshot.records, snpshot.fields)
  return new TextEncoder().encode(
    Papa.unparse({
      fields: snpshot.fields.map((field) => field.name),
      data: snpshot.records.map((records) =>
        records.map((record, index) => formatRecord(record, snpshot.fields[index].displayType))
      )
    })
  )
}

export function getOwnerDocument(target: Event['target']) {
  return target instanceof HTMLElement ? target.ownerDocument : document
}

export { isUrl }
