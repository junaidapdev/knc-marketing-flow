import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../utils/api-client";
import type {
  Product,
  ProductCategory,
  CreateProductInput,
  UpdateProductInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  ProductFilters,
} from "./types";
import { logger } from "../../utils/logger";

const PRODUCTS_KEY = ["products"] as const;
const CATEGORIES_KEY = ["product-categories"] as const;

// Filter keys map to backend query params (camelCase end-to-end). Booleans
// are serialized as "true"/"false" because URLSearchParams does that anyway
// — being explicit makes the request URL readable in DevTools.
function filtersToParams(f: ProductFilters | undefined): Record<string, string | undefined> {
  if (!f) return {};
  return {
    categoryId: f.categoryId,
    branchId: f.branchId,
    isTrending: f.isTrending ? "true" : undefined,
    isHero: f.isHero ? "true" : undefined,
    tag: f.tag,
    search: f.search,
    includeInactive: f.includeInactive ? "true" : undefined,
  };
}

export function useProducts(filters?: ProductFilters) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, filters],
    queryFn: async (): Promise<Product[]> => {
      const result = await apiRequest<Product[]>("/products", {
        searchParams: filtersToParams(filters),
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export function useProduct(productId: string | null) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, "detail", productId],
    enabled: productId !== null,
    queryFn: async (): Promise<Product> => {
      const result = await apiRequest<Product>(`/products/${productId}`);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProductInput): Promise<Product> => {
      const result = await apiRequest<Product>("/products", { method: "POST", body: input });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      logger.info("product created", { id: product.id });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; input: UpdateProductInput }): Promise<Product> => {
      const result = await apiRequest<Product>(`/products/${args.id}`, {
        method: "PATCH",
        body: args.input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      queryClient.invalidateQueries({ queryKey: [...PRODUCTS_KEY, "detail", product.id] });
    },
  });
}

// Soft delete — backend flips is_active to false.
export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Product> => {
      const result = await apiRequest<Product>(`/products/${id}`, { method: "DELETE" });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
  });
}

// ───── Categories ─────

export function useProductCategories() {
  return useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: async (): Promise<ProductCategory[]> => {
      const result = await apiRequest<ProductCategory[]>("/product-categories");
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCategoryInput): Promise<ProductCategory> => {
      const result = await apiRequest<ProductCategory>("/product-categories", {
        method: "POST",
        body: input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; input: UpdateCategoryInput }): Promise<ProductCategory> => {
      const result = await apiRequest<ProductCategory>(`/product-categories/${args.id}`, {
        method: "PATCH",
        body: args.input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<ProductCategory> => {
      const result = await apiRequest<ProductCategory>(`/product-categories/${id}`, {
        method: "DELETE",
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
  });
}
