export interface SheetValues {
    range: string
    values: string[][]
}
export interface File {
    id: string
    kind: string
    mimeType: string
    name: string
}
export interface getFileByNameResponse {
    files: File[]
}
