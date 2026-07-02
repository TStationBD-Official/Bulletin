"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tag, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, Check } from "lucide-react";
import {
  seedDefaultCategories,
  subscribeToAllCategories,
  createCategory,
  updateCategory,
  toggleCategoryActive,
  deleteCategory,
} from "@/lib/categories";
import { useStore } from "@/store/useStore";
import { Category } from "@/types";
import { PageLoader } from "@/components/LoadingSpinner";
import toast from "react-hot-toast";

const EMOJI_OPTIONS = [
  "📌","📢","📖","🔢","🔬","💻","🎨","💡","🌍","💬",
  "🏆","📝","🎯","🚀","💪","🌟","🎓","🔍","📊","🗂️",
];

const COLOR_PRESETS = [
  "#6366f1","#3b82f6","#06b6d4","#10b981","#f59e0b",
  "#f97316","#ef4444","#ec4899","#8b5cf6","#14b8a6",
  "#84cc16","#6b7280",
];

interface CategoryForm {
  name: string;
  description: string;
  icon: string;
  color: string;
  order: number;
}

const EMPTY_FORM: CategoryForm = { name: "", description: "", icon: "📌", color: "#6366f1", order: 0 };

export default function CategoriesPage() {
  const { user } = useStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Seed defaults then subscribe to real-time updates
    seedDefaultCategories(user.uid).catch(() => {});
    const unsub = subscribeToAllCategories((cats) => {
      setCategories(cats);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, order: categories.length });
    setShowForm(true);
  };

  const openEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, description: cat.description, icon: cat.icon, color: cat.color, order: cat.order });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateCategory(editingId, form, user.uid);
        toast.success("Category updated");
      } else {
        await createCategory(form, user.uid);
        toast.success("Category created");
      }
      closeForm();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (cat: Category) => {
    if (!user) return;
    try {
      await toggleCategoryActive(cat.id, !cat.isActive, user.uid);
      toast.success(cat.isActive ? "Category deactivated" : "Category activated");
    } catch {
      toast.error("Failed to toggle category");
    }
  };

  const handleDelete = async (catId: string) => {
    if (!user) return;
    const cat = categories.find((c) => c.id === catId);
    if (cat?.isDefault) { toast.error("Cannot delete the default category"); return; }
    setDeletingId(catId);
    try {
      await deleteCategory(catId, user.uid);
      toast.success("Category deleted. Posts moved to General.");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete category");
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <main className="p-6 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Tag size={28} className="text-brand-500 flex-shrink-0" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-dark-primary">Categories</h1>
              <p className="text-gray-500 dark:text-dark-tertiary text-sm mt-0.5">
                {categories.length} categories · {categories.filter((c) => c.isActive).length} active
              </p>
            </div>
          </div>
          <button
            onClick={openNew}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500 text-white text-sm font-semibold rounded-xl hover:bg-brand-600 transition-colors w-full sm:w-auto"
          >
            <Plus size={16} /> New Category
          </button>
        </div>

        {/* Inline form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border p-6 shadow-card">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-gray-900 dark:text-dark-primary">
                    {editingId ? "Edit Category" : "New Category"}
                  </h2>
                  <button onClick={closeForm} className="p-1 hover:bg-gray-100 dark:hover:bg-dark-border rounded-lg transition-colors">
                    <X size={16} className="text-gray-500" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-dark-secondary uppercase tracking-wide mb-1.5">Name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Physics"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  {/* Description */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-dark-secondary uppercase tracking-wide mb-1.5">Description</label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Brief description"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  {/* Emoji picker */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-dark-secondary uppercase tracking-wide mb-1.5">Icon</label>
                    <div className="flex flex-wrap gap-1.5">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, icon: emoji }))}
                          className={`w-9 h-9 text-lg rounded-lg flex items-center justify-center transition-all ${
                            form.icon === emoji
                              ? "bg-brand-100 dark:bg-brand-900/30 ring-2 ring-brand-500"
                              : "bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-dark-border"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color picker */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-dark-secondary uppercase tracking-wide mb-1.5">Color</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {COLOR_PRESETS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, color }))}
                          className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                          style={{ backgroundColor: color }}
                        >
                          {form.color === color && <Check size={13} className="text-white" />}
                        </button>
                      ))}
                    </div>
                    {/* Preview */}
                    <div
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                      style={{ backgroundColor: form.color + "18", color: form.color }}
                    >
                      {form.icon} {form.name || "Preview"}
                    </div>
                  </div>

                  {/* Order */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-dark-secondary uppercase tracking-wide mb-1.5">Display Order</label>
                    <input
                      type="number"
                      min={0}
                      value={form.order}
                      onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
                      className="w-24 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-dark-border">
                  <button
                    onClick={closeForm}
                    className="px-4 py-2 text-sm border border-gray-200 dark:border-dark-border text-gray-600 dark:text-dark-secondary rounded-xl hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-5 py-2 text-sm bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Saving…" : editingId ? "Save Changes" : "Create Category"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category table */}
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-200 dark:border-dark-border shadow-card overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-dark-border">
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-dark-tertiary uppercase tracking-wide px-5 py-3">Category</th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-dark-tertiary uppercase tracking-wide px-5 py-3 hidden sm:table-cell">Slug</th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-dark-tertiary uppercase tracking-wide px-5 py-3 hidden md:table-cell">Posts</th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-dark-tertiary uppercase tracking-wide px-5 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-gray-500 dark:text-dark-tertiary uppercase tracking-wide px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50 dark:hover:bg-dark-bg/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                        style={{ backgroundColor: cat.color + "18" }}
                      >
                        {cat.icon}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900 dark:text-dark-primary">{cat.name}</p>
                          {cat.isDefault && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-dark-border text-gray-500 dark:text-dark-tertiary">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        {cat.description && (
                          <p className="text-xs text-gray-400 dark:text-dark-tertiary">{cat.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <code className="text-xs text-gray-500 dark:text-dark-tertiary bg-gray-100 dark:bg-dark-border px-2 py-0.5 rounded">
                      {cat.slug}
                    </code>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="text-sm font-medium text-gray-700 dark:text-dark-secondary">{cat.postCount}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      cat.isActive
                        ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                        : "bg-gray-100 text-gray-500 dark:bg-dark-border dark:text-dark-tertiary"
                    }`}>
                      {cat.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Edit */}
                      <button
                        onClick={() => openEdit(cat)}
                        title="Edit"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>

                      {/* Toggle active */}
                      <button
                        onClick={() => handleToggle(cat)}
                        title={cat.isActive ? "Deactivate" : "Activate"}
                        disabled={cat.isDefault && cat.isActive}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {cat.isActive ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                      </button>

                      {/* Delete */}
                      {!cat.isDefault && (
                        confirmDelete === cat.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(cat.id)}
                              disabled={deletingId === cat.id}
                              className="px-2 py-1 text-[11px] font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                            >
                              {deletingId === cat.id ? "…" : "Confirm"}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="px-2 py-1 text-[11px] bg-gray-100 dark:bg-dark-border text-gray-600 dark:text-dark-secondary rounded-lg"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(cat.id)}
                            title="Delete"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 dark:text-dark-tertiary mt-4 text-center">
          Deleting a category moves all its posts to the default "General" category.
        </p>
      </div>
    </main>
  );
}
