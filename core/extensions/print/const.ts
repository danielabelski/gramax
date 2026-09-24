/** The sheet the export prints on. */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/**
 * The page box, in the pixels the layout is measured in: 900 wide, and shaped like the sheet.
 *
 * Print media scales the box onto the paper by one factor, so only a box with the sheet's proportions fills it
 * edge to edge. At 900x1350 it was taller for its width than A4, fitted by its height, and every sheet came out
 * with 12mm of it unused down the right-hand side.
 *
 * An A4-shaped box was once tried and dropped (the boxes ran together and the page number crept up the sheet),
 * but that was while the browser fitted the box to the paper's width by itself; the scale is explicit now.
 */
export const PAGE_WIDTH_PDF = 900;
export const PAGE_HEIGHT_PDF = (PAGE_WIDTH_PDF * A4_HEIGHT_MM) / A4_WIDTH_MM;
export const HEIGHT_TOLERANCE_PX = 0.5;

/** Dev switch, in localStorage so it survives a reload: the export stops right before the browser's print dialog. */
export const NO_PRINT_KEY = "NO_PRINT";
