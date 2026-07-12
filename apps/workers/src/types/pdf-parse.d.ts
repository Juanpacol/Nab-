// La implementación interna de pdf-parse no trae tipos; declaramos el subpath
// que importamos para evitar el modo debug de su index.js.
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: unknown;
  }
  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}
