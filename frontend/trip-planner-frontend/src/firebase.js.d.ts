declare module "./firebase.js" {
  export const auth: any;
  export const provider: any;
  export function signInWithPopup(auth: any, provider: any): Promise<{ user: any }>;
  export function signOut(auth: any): Promise<void>;
}
