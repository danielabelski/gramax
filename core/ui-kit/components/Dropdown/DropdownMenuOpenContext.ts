import { createContext, useContext } from "react";

/** `undefined` means the button is not inside our `DropdownMenu` wrapper — Radix sets `data-state` itself then. */
export const DropdownMenuOpenContext = createContext<boolean | undefined>(undefined);

export const useDropdownMenuOpen = () => useContext(DropdownMenuOpenContext);
