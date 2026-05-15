import type { CharacterCard, Chat, ChatMessage, Lorebook } from "../domain/types";

type MessageRecord = ChatMessage & {
  id: string;
  chatId: string;
  createdAt: string;
};

type StoreValueMap = {
  characters: CharacterCard;
  lorebooks: Lorebook;
  chats: Chat;
  messages: MessageRecord;
};

export type StoreName = keyof StoreValueMap;

const DB_NAME = "yunwu";
const DB_VERSION = 1;
let databasePromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      createStore(db, "characters");
      createStore(db, "lorebooks");
      createStore(db, "chats");
      if (!db.objectStoreNames.contains("messages")) {
        const messages = db.createObjectStore("messages", { keyPath: "id" });
        messages.createIndex("chatId", "chatId", { unique: false });
      } else {
        const transaction = request.transaction;
        const messages = transaction?.objectStore("messages");
        if (messages && !messages.indexNames.contains("chatId")) {
          messages.createIndex("chatId", "chatId", { unique: false });
        }
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        databasePromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });

  return databasePromise;
}

export async function getAll<TName extends StoreName>(
  storeName: TName,
): Promise<StoreValueMap[TName][]> {
  const store = await getStore(storeName, "readonly");
  return requestToPromise<StoreValueMap[TName][]>(store.getAll());
}

export async function getOne<TName extends StoreName>(
  storeName: TName,
  id: string,
): Promise<StoreValueMap[TName] | null> {
  const store = await getStore(storeName, "readonly");
  const result = await requestToPromise<StoreValueMap[TName] | undefined>(store.get(id));
  return result ?? null;
}

export async function putOne<TName extends StoreName>(
  storeName: TName,
  value: StoreValueMap[TName],
): Promise<StoreValueMap[TName]> {
  const store = await getStore(storeName, "readwrite");
  await requestToPromise<IDBValidKey>(store.put(value));
  return value;
}

export async function deleteOne<TName extends StoreName>(
  storeName: TName,
  id: string,
): Promise<void> {
  const store = await getStore(storeName, "readwrite");
  await requestToPromise<undefined>(store.delete(id));
}

export async function getMessagesByChatId(chatId: string): Promise<MessageRecord[]> {
  const store = await getStore("messages", "readonly");
  const index = store.index("chatId");
  const messages = await requestToPromise<MessageRecord[]>(index.getAll(chatId));
  return messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function deleteMessagesByChatId(chatId: string): Promise<void> {
  const store = await getStore("messages", "readwrite");
  const index = store.index("chatId");
  const keys = await requestToPromise<IDBValidKey[]>(index.getAllKeys(chatId));
  await Promise.all(keys.map((key) => requestToPromise<undefined>(store.delete(key))));
}

export async function clearDatabase(): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([...db.objectStoreNames], "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);

    for (const storeName of db.objectStoreNames) {
      transaction.objectStore(storeName).clear();
    }
  });
}

function createStore(db: IDBDatabase, storeName: Exclude<StoreName, "messages">): void {
  if (!db.objectStoreNames.contains(storeName)) {
    db.createObjectStore(storeName, { keyPath: "id" });
  }
}

async function getStore(storeName: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDatabase();
  return db.transaction(storeName, mode).objectStore(storeName);
}

function requestToPromise<TResult>(request: IDBRequest<TResult>): Promise<TResult> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
