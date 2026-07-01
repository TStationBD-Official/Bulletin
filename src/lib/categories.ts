import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { Category } from "@/types";

export const SEED_CATEGORIES: Omit<Category, "createdAt" | "updatedAt" | "createdBy">[] = [
  { id: "general",       name: "General",             slug: "general",       description: "General posts and discussions", color: "#6366f1", icon: "📌", postCount: 0, isDefault: true,  isActive: true, order: 0 },
  { id: "mathematics",   name: "Mathematics",          slug: "mathematics",   description: "Math problems, tips and tricks",color: "#f59e0b", icon: "🔢", postCount: 0, isDefault: false, isActive: true, order: 1 },
  { id: "science",       name: "Science",              slug: "science",       description: "Physics, Chemistry, Biology",   color: "#10b981", icon: "🔬", postCount: 0, isDefault: false, isActive: true, order: 2 },
  { id: "english",       name: "English",              slug: "english",       description: "Grammar, literature, writing",  color: "#3b82f6", icon: "📖", postCount: 0, isDefault: false, isActive: true, order: 3 },
  { id: "history",       name: "History & Geography",  slug: "history",       description: "History, civics and geography", color: "#8b5cf6", icon: "🌍", postCount: 0, isDefault: false, isActive: true, order: 4 },
  { id: "technology",    name: "Technology",           slug: "technology",    description: "Computers, coding and tech",    color: "#06b6d4", icon: "💻", postCount: 0, isDefault: false, isActive: true, order: 5 },
  { id: "arts",          name: "Arts & Creativity",   slug: "arts",          description: "Drawing, music, crafts",         color: "#ec4899", icon: "🎨", postCount: 0, isDefault: false, isActive: true, order: 6 },
  { id: "study-tips",    name: "Study Tips",           slug: "study-tips",    description: "Productivity and study hacks",  color: "#f97316", icon: "💡", postCount: 0, isDefault: false, isActive: true, order: 7 },
  { id: "announcements", name: "Announcements",        slug: "announcements", description: "Important notices and updates", color: "#ef4444", icon: "📢", postCount: 0, isDefault: false, isActive: true, order: 8 },
  { id: "qna",           name: "Q&A",                  slug: "qna",           description: "Ask and answer questions",      color: "#14b8a6", icon: "💬", postCount: 0, isDefault: false, isActive: true, order: 9 },
];

export const DEFAULT_CATEGORY = {
  id: "general",
  name: "General",
  color: "#6366f1",
  icon: "📌",
};

// Seed all default categories into Firestore (idempotent — skips existing)
export async function seedDefaultCategories(uid: string): Promise<void> {
  // 1 read instead of 10 individual getDoc calls
  const existingSnap = await getDocs(collection(db, "categories"));
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));

  const toSeed = SEED_CATEGORIES.filter((cat) => !existingIds.has(cat.id));
  if (toSeed.length === 0) return;

  const batch = writeBatch(db);
  toSeed.forEach((cat) => {
    batch.set(doc(db, "categories", cat.id), {
      ...cat,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

// Get all active categories — single-field index only (no composite index needed)
export async function getCategories(): Promise<Category[]> {
  const snap = await getDocs(
    query(collection(db, "categories"), orderBy("order", "asc"))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Category))
    .filter((c) => c.isActive !== false);
}

// Get all categories (including inactive) for admin management
export async function getAllCategoriesAdmin(): Promise<Category[]> {
  const snap = await getDocs(
    query(collection(db, "categories"), orderBy("order", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
}

// Real-time subscription for admin page
export function subscribeToAllCategories(callback: (cats: Category[]) => void) {
  const q = query(collection(db, "categories"), orderBy("order", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category)));
  });
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const snap = await getDoc(doc(db, "categories", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Category;
}

export async function createCategory(
  data: { name: string; description: string; color: string; icon: string; order: number },
  uid: string
): Promise<void> {
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  await setDoc(doc(db, "categories", slug), {
    id: slug,
    slug,
    name: data.name,
    description: data.description,
    color: data.color,
    icon: data.icon,
    order: data.order,
    postCount: 0,
    isDefault: false,
    isActive: true,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateCategory(
  id: string,
  data: Partial<Pick<Category, "name" | "description" | "color" | "icon" | "order" | "isActive">>,
  uid: string
): Promise<void> {
  await updateDoc(doc(db, "categories", id), {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function toggleCategoryActive(id: string, isActive: boolean, uid: string): Promise<void> {
  await updateDoc(doc(db, "categories", id), {
    isActive,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

// Soft-delete: deactivate category + reassign its posts to "general"
export async function deleteCategory(id: string, uid: string): Promise<void> {
  const catSnap = await getDoc(doc(db, "categories", id));
  if (!catSnap.exists()) throw new Error("Category not found");
  if (catSnap.data().isDefault) throw new Error("Cannot delete the default category");

  // Deactivate
  await updateDoc(doc(db, "categories", id), {
    isActive: false,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  // Reassign posts in batches of 490
  const postsSnap = await getDocs(
    query(collection(db, "posts"), where("categoryId", "==", id))
  );
  for (let i = 0; i < postsSnap.docs.length; i += 490) {
    const batch = writeBatch(db);
    postsSnap.docs.slice(i, i + 490).forEach((d) => {
      batch.update(d.ref, {
        categoryId: "general",
        categoryName: "General",
        categoryColor: "#6366f1",
        categoryIcon: "📌",
      });
    });
    await batch.commit();
  }
}
