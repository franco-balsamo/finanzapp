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

// Aviso de que cambió la cola sin conexión (02 §5, "Sin conexión"): "Sin enviar" e Inicio la vuelven a leer.
const pendingListeners = new Set<Listener>();

export function onPendingChanged(listener: Listener): () => void {
  pendingListeners.add(listener);
  return () => pendingListeners.delete(listener);
}

export function pendingChanged(): void {
  pendingListeners.forEach((l) => l());
}
