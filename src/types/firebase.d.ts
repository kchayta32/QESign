declare module 'firebase/app' {
  export function initializeApp(config: any): any;
  export function getApps(): any[];
  export function getApp(): any;
  export type FirebaseApp = any;
}

declare module 'firebase/auth' {
  export function getAuth(app?: any): any;
  export function createUserWithEmailAndPassword(auth: any, email: string, password: string): Promise<any>;
  export function signInWithEmailAndPassword(auth: any, email: string, password: string): Promise<any>;
  export function signOut(auth: any): Promise<void>;
  export function updateProfile(user: any, profile: any): Promise<void>;
  export function onAuthStateChanged(auth: any, nextOrObserver: any): any;
  export type Auth = any;
  export type User = any;
}

declare module 'firebase/firestore' {
  export function getFirestore(app?: any): any;
  export function collection(firestore: any, path: string, ...pathSegments: string[]): any;
  export function doc(firestore: any, path: string, ...pathSegments: string[]): any;
  export function setDoc(reference: any, data: any, options?: any): Promise<void>;
  export function getDoc(reference: any): Promise<any>;
  export function getDocs(query: any): Promise<any>;
  export function addDoc(reference: any, data: any): Promise<any>;
  export function updateDoc(reference: any, data: any, ...moreFieldsAndValues: any[]): Promise<void>;
  export function onSnapshot(referenceOrQuery: any, onNext: (snapshot: any) => void, onError?: (error: any) => void): any;
  export type Firestore = any;
}

declare module 'firebase/database' {
  export function getDatabase(app?: any, url?: string): any;
  export function ref(database: any, path?: string): any;
  export function set(reference: any, value: any): Promise<void>;
  export function get(reference: any): Promise<any>;
  export function update(reference: any, values: any): Promise<void>;
  export function push(reference: any, value?: any): any;
  export function onValue(reference: any, callback: (snapshot: any) => void, cancelCallback?: (error: any) => void): () => void;
  export function child(reference: any, path: string): any;
  export type Database = any;
}

declare module 'firebase/storage' {
  export function getStorage(app?: any): any;
  export function ref(storage: any, url?: string): any;
  export function uploadBytes(ref: any, data: any): Promise<any>;
  export function getDownloadURL(ref: any): Promise<string>;
  export type FirebaseStorage = any;
}

declare module 'firebase/analytics' {
  export function getAnalytics(app?: any): any;
  export function isSupported(): Promise<boolean>;
  export type Analytics = any;
}
