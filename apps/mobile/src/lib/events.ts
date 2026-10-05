// Aviso de que cambiaron los datos de la Billetera (un gasto guardado o deshecho), para que la
// pantalla vuelva a calcular aunque no reciba foco (el "Deshacer" del toast pasa con ella a la vista).

type Listener = () => void;
const listeners = new Set<Listener>();

export function onWalletChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function walletChanged(): void {
  listeners.forEach((l) => l());
}
