/**
 * Ayurvedic Food Database + Recipe Library — frontend type definitions.
 *
 * Mirrors the Prisma models on the backend; consumed by the FoodDatabase
 * page, RecipeLibrary page, and the structured-foods section inside
 * DietMealRow / PatientDiet.
 */

// ── Enums (string-literal unions to avoid runtime enum cost) ───────────────

export type FoodCategory =
  | 'GRAIN'
  | 'VEGETABLE'
  | 'FRUIT'
  | 'DAIRY'
  | 'SPICE'
  | 'OIL'
  | 'LEGUME'
  | 'MEAT'
  | 'HERB'
  | 'BEVERAGE'
  | 'OTHER';

export type RasaType =
  | 'SWEET'
  | 'SOUR'
  | 'SALTY'
  | 'PUNGENT'
  | 'BITTER'
  | 'ASTRINGENT';

export type GunaType =
  | 'HEAVY' | 'LIGHT' | 'OILY' | 'DRY' | 'HOT' | 'COLD'
  | 'SHARP' | 'SOFT' | 'STABLE' | 'MOBILE';

export type Season = 'WINTER' | 'SUMMER' | 'MONSOON' | 'AUTUMN' | 'SPRING';

export type DoshaTarget = 'VATA' | 'PITTA' | 'KAPHA' | 'TRIDOSHA';

/** A single dosha's effect from a food. Free-form string so the backend
 *  can extend without a frontend release; UI maps unknown values to a
 *  neutral chip. */
export type DoshaEffect = 'PACIFYING' | 'NEUTRAL' | 'AGGRAVATING';

export type Virya = 'HOT' | 'COLD' | 'NEUTRAL';

export type MealCategory =
  | 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'BEVERAGE' | 'GENERAL';

/** Where a food row appears inside a DietMeal — eat-list or avoid-list. */
export type MealFoodCategory = 'EAT' | 'AVOID';

// ── Core models ────────────────────────────────────────────────────────────

export interface AyurvedicFood {
  id: string;
  name: string;
  nameInTamil?: string | null;
  nameInSanskrit?: string | null;
  category: FoodCategory;
  doshaEffectVata: DoshaEffect | string;
  doshaEffectPitta: DoshaEffect | string;
  doshaEffectKapha: DoshaEffect | string;
  rasa: RasaType[];
  guna: GunaType[];
  virya: Virya | string;
  seasons: Season[];
  preparationMethods: string[];
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
  commonAllergies: string[];
  isActive: boolean;
  branchId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  foodId: string;
  quantity: number;
  unit: string;
  notes?: string | null;
  sortOrder: number;
  food?: Pick<AyurvedicFood, 'id' | 'name' | 'nameInTamil' | 'category'> | null;
}

export interface AyurvedicRecipe {
  id: string;
  name: string;
  nameInTamil?: string | null;
  description?: string | null;
  doshaTargets: string[];
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  instructions: string[];
  mealCategory: MealCategory | string;
  imageUrl?: string | null;
  isActive: boolean;
  branchId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  ingredients?: RecipeIngredient[];
  /** Returned by list endpoint. */
  _count?: { ingredients: number };
}

export interface DietMealFoodLink {
  id: string;
  mealId: string;
  foodId?: string | null;
  foodNameFree?: string | null;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  isAvoid: boolean;
  sortOrder: number;
  createdAt: string;
  food?: Pick<
    AyurvedicFood,
    | 'id'
    | 'name'
    | 'nameInTamil'
    | 'category'
    | 'calories'
    | 'doshaEffectVata'
    | 'doshaEffectPitta'
    | 'doshaEffectKapha'
  > | null;
}

// ── API response shapes ────────────────────────────────────────────────────

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedFoods {
  data: AyurvedicFood[];
  pagination: Pagination;
}

export interface PaginatedRecipes {
  data: AyurvedicRecipe[];
  pagination: Pagination;
}

/** Returned by GET /suggest — the leaner shape for autocomplete dropdowns. */
export interface FoodSuggestion {
  id: string;
  name: string;
  nameInTamil?: string | null;
  category: FoodCategory;
  doshaEffectVata: string;
  doshaEffectPitta: string;
  doshaEffectKapha: string;
  calories?: number | null;
}

export interface AllergyConflict {
  foodId: string;
  foodName: string;
  allergen: string;
}

export interface AllergyConflictResponse {
  hasConflict: boolean;
  conflicts: AllergyConflict[];
}

export interface BulkImportError {
  row: number;
  error: string;
  code?: string;
}

export interface BulkImportResult {
  imported: number;
  skipped: number;
  errors: BulkImportError[];
}

export interface MealFoodLinks {
  foods: DietMealFoodLink[];
  avoidFoods: DietMealFoodLink[];
}

export interface FoodDatabaseStats {
  totalFoods: number;
  totalRecipes: number;
  byCategory: Record<FoodCategory, number>;
}

// ── Form payloads ──────────────────────────────────────────────────────────

export type AyurvedicFoodInput = Omit<
  AyurvedicFood,
  'id' | 'branchId' | 'createdById' | 'createdAt' | 'updatedAt'
>;

export interface RecipeIngredientInput {
  foodId: string;
  quantity: number;
  unit: string;
  notes?: string | null;
  sortOrder?: number;
}

export type AyurvedicRecipeInput = Omit<
  AyurvedicRecipe,
  'id' | 'branchId' | 'createdById' | 'createdAt' | 'updatedAt' | 'ingredients' | '_count'
> & {
  ingredients?: RecipeIngredientInput[];
};

export interface LinkFoodInput {
  foodId?: string;
  foodNameFree?: string;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  isAvoid?: boolean;
}
