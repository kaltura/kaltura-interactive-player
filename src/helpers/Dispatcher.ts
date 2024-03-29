/**
 * Simple (Event)Dispatcher class
 * Inspiered by https://medium.com/@LeoAref/simple-event-dispatcher-implementation-using-javascript-36d0eadf5a11
 */

export interface KivEvent {
  type: string;
  payload?: any;
}
export class Dispatcher {
  events: any;

  constructor() {
    this.events = {};
  }

  addListener(type: string, callback: (data?: any) => any) {
    // Create the event if not exists
    if (this.events[type] === undefined) {
      this.events[type] = {
        listeners: []
      };
    }
    this.events[type].listeners.push(callback);
  }

  removeListener(type: string, callback: (data?: any) => any) {
    // Check if this event not exists
    if (this.events[type] === undefined) {
      return false;
    }
    this.events[type].listeners = this.events[type].listeners.filter(
      (listener: string) => {
        return listener.toString() !== callback.toString();
      }
    );
  }

  dispatch(event: KivEvent) {
    // If event doesn't have a listener - don't do anything
    if (this.events[event.type] === undefined) {
      return false;
    }
    this.events[event.type].listeners.forEach((listener: any) => {
      if (event.payload) {
        listener({ type: event.type, payload: event.payload });
      } else {
        listener({ type: event.type });
      }
    });
  }
}
