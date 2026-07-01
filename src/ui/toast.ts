const CONTAINER_ID = "toast-container";
const LEAVE_DURATION_MS = 200;

export type ToastType = "error" | "success" | "info";

type ToastElement = HTMLElement & { _timer?: ReturnType<typeof setTimeout> };

function getContainer(): HTMLElement {
  let el = document.getElementById(CONTAINER_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = CONTAINER_ID;
    el.className = "toast-container";
    document.body.appendChild(el);
  }
  return el;
}

function remove(toast: ToastElement): void {
  clearTimeout(toast._timer);
  toast.classList.remove("toast--visible");
  toast.classList.add("toast--leaving");
  setTimeout(() => {
    toast.remove();
  }, LEAVE_DURATION_MS);
}

export function showToast(message: string, type: ToastType = "info", duration: number = 4000): void {
  const container = getContainer();
  const toast: ToastElement = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;

  toast.addEventListener("click", () => remove(toast));

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("toast--visible");
  });

  toast._timer = setTimeout(() => remove(toast), duration);
}
