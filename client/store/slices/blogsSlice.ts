import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/lib/api";
import type {
  BlogListResponse,
  BlogPostPublic,
  BlogPostResponse,
  BlogPostStaff,
  BlogSlugCheckResponse,
  BlogStaffListResponse,
  BlogStaffPostResponse,
  BlogUpsertRequest,
  StaffRole,
} from "@shared/api";
import { extractApiErrorMessage } from "@/utils/apiError";

function blogStaffBase(role: StaffRole): string {
  return role === "admin" ? "/admin/blog-posts" : "/organizer/blog-posts";
}

interface BlogsState {
  publicPosts: BlogPostPublic[];
  publicLoading: boolean;
  publicError: string | null;
  eventPosts: BlogPostPublic[];
  eventPostsLoading: boolean;
  eventPostsError: string | null;
  publicPost: BlogPostPublic | null;
  publicPostLoading: boolean;
  publicPostError: string | null;
  staffPosts: BlogPostStaff[];
  staffLoading: boolean;
  staffError: string | null;
  staffPost: BlogPostStaff | null;
  staffPostLoading: boolean;
  staffPostError: string | null;
  saving: boolean;
  deleting: boolean;
  saveError: string | null;
}

const initialState: BlogsState = {
  publicPosts: [],
  publicLoading: false,
  publicError: null,
  eventPosts: [],
  eventPostsLoading: false,
  eventPostsError: null,
  publicPost: null,
  publicPostLoading: false,
  publicPostError: null,
  staffPosts: [],
  staffLoading: false,
  staffError: null,
  staffPost: null,
  staffPostLoading: false,
  staffPostError: null,
  saving: false,
  deleting: false,
  saveError: null,
};

export const fetchPublicBlogList = createAsyncThunk<
  BlogListResponse,
  {
    limit?: number;
    offset?: number;
    featured?: boolean;
    organizer?: string;
    locale?: string;
    event?: string;
  } | undefined,
  { rejectValue: string }
>("blogs/fetchPublicList", async (params, { rejectWithValue }) => {
  const p = params ?? {};
  try {
    const { data } = await api.get<BlogListResponse>("/public/blog", {
      params: {
        limit: p.limit,
        offset: p.offset,
        featured: p.featured ? "1" : undefined,
        organizer: p.organizer,
        locale: p.locale,
        event: p.event,
      },
    });
    return data;
  } catch (e: unknown) {
    return rejectWithValue(extractApiErrorMessage(e, "Could not load blog posts"));
  }
});

export const fetchEventBlogPosts = createAsyncThunk<
  BlogListResponse,
  { event: string; locale?: string; limit?: number },
  { rejectValue: string }
>("blogs/fetchEventPosts", async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get<BlogListResponse>("/public/blog", {
      params: {
        event: params.event,
        locale: params.locale,
        limit: params.limit ?? 6,
      },
    });
    return data;
  } catch (e: unknown) {
    return rejectWithValue(extractApiErrorMessage(e, "Could not load event blog posts"));
  }
});

export const fetchPublicBlogPost = createAsyncThunk<
  BlogPostPublic,
  string,
  { rejectValue: string }
>("blogs/fetchPublicPost", async (slug, { rejectWithValue }) => {
  try {
    const { data } = await api.get<BlogPostResponse>(`/public/blog/${encodeURIComponent(slug)}`);
    return data.post;
  } catch (e: unknown) {
    return rejectWithValue(extractApiErrorMessage(e, "Could not load blog post"));
  }
});

export const fetchStaffBlogPosts = createAsyncThunk<
  BlogPostStaff[],
  StaffRole,
  { rejectValue: string }
>("blogs/fetchStaffPosts", async (role, { rejectWithValue }) => {
  try {
    const { data } = await api.get<BlogStaffListResponse>(blogStaffBase(role));
    return data.posts;
  } catch (e: unknown) {
    return rejectWithValue(extractApiErrorMessage(e, "Could not load blog posts"));
  }
});

export const fetchStaffBlogPost = createAsyncThunk<
  BlogPostStaff,
  { role: StaffRole; postId: number },
  { rejectValue: string }
>("blogs/fetchStaffPost", async ({ role, postId }, { rejectWithValue }) => {
  try {
    const { data } = await api.get<BlogStaffPostResponse>(`${blogStaffBase(role)}/${postId}`);
    return data.post;
  } catch (e: unknown) {
    return rejectWithValue(extractApiErrorMessage(e, "Could not load blog post"));
  }
});

export const createStaffBlogPost = createAsyncThunk<
  BlogPostStaff,
  { role: StaffRole; body: BlogUpsertRequest },
  { rejectValue: string }
>("blogs/createStaffPost", async ({ role, body }, { rejectWithValue }) => {
  try {
    const { data } = await api.post<BlogStaffPostResponse>(blogStaffBase(role), body);
    return data.post;
  } catch (e: unknown) {
    return rejectWithValue(extractApiErrorMessage(e, "Could not create blog post"));
  }
});

export const updateStaffBlogPost = createAsyncThunk<
  BlogPostStaff,
  { role: StaffRole; postId: number; body: BlogUpsertRequest },
  { rejectValue: string }
>("blogs/updateStaffPost", async ({ role, postId, body }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch<BlogStaffPostResponse>(
      `${blogStaffBase(role)}/${postId}`,
      body,
    );
    return data.post;
  } catch (e: unknown) {
    return rejectWithValue(extractApiErrorMessage(e, "Could not update blog post"));
  }
});

export const deleteStaffBlogPost = createAsyncThunk<
  number,
  { role: StaffRole; postId: number },
  { rejectValue: string }
>("blogs/deleteStaffPost", async ({ role, postId }, { rejectWithValue }) => {
  try {
    await api.delete(`${blogStaffBase(role)}/${postId}`);
    return postId;
  } catch (e: unknown) {
    return rejectWithValue(extractApiErrorMessage(e, "Could not delete blog post"));
  }
});

export const checkBlogSlug = createAsyncThunk<
  BlogSlugCheckResponse,
  { role: StaffRole; slug: string; excludeId?: number },
  { rejectValue: string }
>("blogs/checkSlug", async ({ role, slug, excludeId }, { rejectWithValue }) => {
  try {
    const { data } = await api.get<BlogSlugCheckResponse>(
      `${blogStaffBase(role)}/check-slug`,
      { params: { slug, excludeId: excludeId ?? undefined } },
    );
    return data;
  } catch (e: unknown) {
    return rejectWithValue(extractApiErrorMessage(e, "Could not check slug"));
  }
});

const slice = createSlice({
  name: "blogs",
  initialState,
  reducers: {
    clearPublicBlogPost(state) {
      state.publicPost = null;
      state.publicPostError = null;
    },
    clearStaffBlogPost(state) {
      state.staffPost = null;
      state.staffPostError = null;
      state.saveError = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchPublicBlogList.pending, (s) => {
      s.publicLoading = true;
      s.publicError = null;
    });
    b.addCase(fetchPublicBlogList.fulfilled, (s, a) => {
      s.publicLoading = false;
      s.publicPosts = a.payload.posts;
    });
    b.addCase(fetchPublicBlogList.rejected, (s, a) => {
      s.publicLoading = false;
      s.publicError = a.payload || "Error";
    });

    b.addCase(fetchEventBlogPosts.pending, (s) => {
      s.eventPostsLoading = true;
      s.eventPostsError = null;
    });
    b.addCase(fetchEventBlogPosts.fulfilled, (s, a) => {
      s.eventPostsLoading = false;
      s.eventPosts = a.payload.posts;
    });
    b.addCase(fetchEventBlogPosts.rejected, (s, a) => {
      s.eventPostsLoading = false;
      s.eventPostsError = a.payload || "Error";
    });

    b.addCase(fetchPublicBlogPost.pending, (s) => {
      s.publicPostLoading = true;
      s.publicPostError = null;
    });
    b.addCase(fetchPublicBlogPost.fulfilled, (s, a) => {
      s.publicPostLoading = false;
      s.publicPost = a.payload;
    });
    b.addCase(fetchPublicBlogPost.rejected, (s, a) => {
      s.publicPostLoading = false;
      s.publicPostError = a.payload || "Error";
    });

    b.addCase(fetchStaffBlogPosts.pending, (s) => {
      s.staffLoading = true;
      s.staffError = null;
    });
    b.addCase(fetchStaffBlogPosts.fulfilled, (s, a) => {
      s.staffLoading = false;
      s.staffPosts = a.payload;
    });
    b.addCase(fetchStaffBlogPosts.rejected, (s, a) => {
      s.staffLoading = false;
      s.staffError = a.payload || "Error";
    });

    b.addCase(fetchStaffBlogPost.pending, (s) => {
      s.staffPostLoading = true;
      s.staffPostError = null;
    });
    b.addCase(fetchStaffBlogPost.fulfilled, (s, a) => {
      s.staffPostLoading = false;
      s.staffPost = a.payload;
    });
    b.addCase(fetchStaffBlogPost.rejected, (s, a) => {
      s.staffPostLoading = false;
      s.staffPostError = a.payload || "Error";
    });

    b.addCase(createStaffBlogPost.pending, (s) => {
      s.saving = true;
      s.saveError = null;
    });
    b.addCase(createStaffBlogPost.fulfilled, (s, a) => {
      s.saving = false;
      s.staffPost = a.payload;
      s.staffPosts = [a.payload, ...s.staffPosts.filter((p) => p.id !== a.payload.id)];
    });
    b.addCase(createStaffBlogPost.rejected, (s, a) => {
      s.saving = false;
      s.saveError = a.payload || "Error";
    });

    b.addCase(updateStaffBlogPost.pending, (s) => {
      s.saving = true;
      s.saveError = null;
    });
    b.addCase(updateStaffBlogPost.fulfilled, (s, a) => {
      s.saving = false;
      s.staffPost = a.payload;
      s.staffPosts = s.staffPosts.map((p) => (p.id === a.payload.id ? a.payload : p));
    });
    b.addCase(updateStaffBlogPost.rejected, (s, a) => {
      s.saving = false;
      s.saveError = a.payload || "Error";
    });

    b.addCase(deleteStaffBlogPost.pending, (s) => {
      s.deleting = true;
    });
    b.addCase(deleteStaffBlogPost.fulfilled, (s, a) => {
      s.deleting = false;
      s.staffPosts = s.staffPosts.filter((p) => p.id !== a.payload);
      if (s.staffPost?.id === a.payload) s.staffPost = null;
    });
    b.addCase(deleteStaffBlogPost.rejected, (s) => {
      s.deleting = false;
    });
  },
});

export const { clearPublicBlogPost, clearStaffBlogPost } = slice.actions;
export default slice.reducer;
