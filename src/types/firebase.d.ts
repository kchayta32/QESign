declare module 'firebase/app' {
  export function initializeApp(config: any): any;
  export function getApps(): any[];
  export function getApp(): any;
  export type FirebaseApp = any;
}

declare module 'firebase/auth' {
  export function getAuth(app?: any): any;
  export type Auth = any;
}

declare module 'firebase/firestore' {
  export function getFirestore(app?: any): any;
  export type Firestore = any;
}

declare module 'firebase/storage' {
  export function getStorage(app?: any): any;
  export type FirebaseStorage = any;
}

declare module 'firebase/analytics' {
  export function getAnalytics(app?: any): any;
  export function isSupported(): Promise<boolean>;
  export type Analytics = any;
}
