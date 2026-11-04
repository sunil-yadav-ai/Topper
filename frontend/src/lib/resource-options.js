export const resourceOptionsUpdatedEvent = "resource-options-updated";

export function notifyResourceOptionsUpdated() {
  window.dispatchEvent(new Event(resourceOptionsUpdatedEvent));
}
