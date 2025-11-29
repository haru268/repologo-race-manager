import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, off, Database } from 'firebase/database';
import { AppState } from '../types';

// Firebase設定（後で実際の値に置き換えます）
// これらの値はFirebaseコンソールで取得できます
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'your-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'your-project.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://your-project-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'your-project-id',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'your-project.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'your-app-id',
};

// Firebase初期化
let app: ReturnType<typeof initializeApp> | null = null;
let database: Database | null = null;

export const initFirebase = (): Database | null => {
  try {
    if (!app) {
      app = initializeApp(firebaseConfig);
      database = getDatabase(app);
    }
    return database;
  } catch (error) {
    console.error('Firebase初期化エラー:', error);
    return null;
  }
};

// データベース参照を取得
const getStateRef = (roomId: string = 'default') => {
  if (!database) {
    database = initFirebase();
  }
  if (!database) return null;
  return ref(database, `rooms/${roomId}/state`);
};

// リアルタイム同期：他のクライアントの変更を監視
export const subscribeToRealtimeUpdates = (
  callback: (state: AppState) => void,
  roomId: string = 'default'
): (() => void) => {
  const stateRef = getStateRef(roomId);
  if (!stateRef) {
    console.warn('Firebaseが初期化されていません。ローカルのみで動作します。');
    return () => {}; // 空の関数を返す（クリーンアップなし）
  }

  // 変更を監視
  onValue(stateRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    }
  }, (error) => {
    console.error('リアルタイム更新エラー:', error);
  });

  // クリーンアップ関数を返す
  return () => {
    if (stateRef) {
      off(stateRef);
    }
  };
};

// データをFirebaseに保存（他のクライアントに即座に反映）
export const saveStateToFirebase = async (
  state: AppState,
  roomId: string = 'default'
): Promise<void> => {
  const stateRef = getStateRef(roomId);
  if (!stateRef) {
    console.warn('Firebaseが初期化されていません。保存されませんでした。');
    return;
  }

  try {
    await set(stateRef, state);
  } catch (error) {
    console.error('Firebase保存エラー:', error);
  }
};

// Firebaseが利用可能かどうかをチェック
export const isFirebaseAvailable = (): boolean => {
  return database !== null;
};

