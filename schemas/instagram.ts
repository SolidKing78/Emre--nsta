import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Meta Instagram Graph API (Instagram Login) shapes                    */
/* ------------------------------------------------------------------ */

export const InstagramAccountSchema = z.object({
  id: z.string(),
  user_id: z.string().optional(),
  username: z.string(),
  name: z.string().optional(),
  biography: z.string().optional(),
  website: z.string().optional(),
  profile_picture_url: z.string().optional(),
  account_type: z.enum(['BUSINESS', 'MEDIA_CREATOR', 'CREATOR', 'PERSONAL']).or(z.string()).optional(),
  media_count: z.number().optional(),
  followers_count: z.number().optional(),
  follows_count: z.number().optional(),
});
export type InstagramApiAccount = z.infer<typeof InstagramAccountSchema>;

export const InstagramMediaChildSchema = z.object({
  id: z.string(),
  media_type: z.string().optional(),
  media_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
});

export const InstagramMediaSchema = z.object({
  id: z.string(),
  media_type: z.string().optional(),
  media_product_type: z.string().optional(),
  media_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  permalink: z.string().optional(),
  caption: z.string().optional(),
  timestamp: z.string(),
  like_count: z.number().optional(),
  comments_count: z.number().optional(),
  username: z.string().optional(),
  children: z.object({ data: z.array(InstagramMediaChildSchema) }).optional(),
});
export type InstagramApiMedia = z.infer<typeof InstagramMediaSchema>;

export const InstagramPagingSchema = z.object({
  cursors: z.object({ before: z.string().optional(), after: z.string().optional() }).optional(),
  next: z.string().optional(),
});

export const InstagramMediaListSchema = z.object({
  data: z.array(InstagramMediaSchema),
  paging: InstagramPagingSchema.optional(),
});

/** Graph API insights entry. `values` for time series, `total_value` for totals. */
export const MetricSchema = z.object({
  name: z.string(),
  period: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  values: z.array(z.object({ value: z.number(), end_time: z.string().optional() })).optional(),
  total_value: z.object({ value: z.number() }).optional(),
});
export type InstagramApiMetric = z.infer<typeof MetricSchema>;

export const InstagramInsightsSchema = z.object({
  data: z.array(MetricSchema),
});

export const InstagramErrorSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    type: z.string().optional(),
    code: z.number().optional(),
    error_subcode: z.number().optional(),
  }),
});

/* ------------------------------------------------------------------ */
/* SocialLens backend contract                                           */
/* ------------------------------------------------------------------ */

export const BackendSessionSchema = z.object({
  session_token: z.string(),
  expires_at: z.string().optional(),
  account: InstagramAccountSchema.extend({
    token_expires_at: z.string().optional(),
    connected_at: z.string().optional(),
  }),
});
export type BackendSession = z.infer<typeof BackendSessionSchema>;

export const BackendAccountSchema = InstagramAccountSchema.extend({
  token_expires_at: z.string().optional(),
  connected_at: z.string().optional(),
  last_sync_at: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/* Instagram public web profile endpoint (no auth, read-only)           */
/* ------------------------------------------------------------------ */

const CountSchema = z.object({ count: z.number() });

const CaptionEdgesSchema = z.object({
  edges: z.array(z.object({ node: z.object({ text: z.string() }) })),
});

export const PublicWebMediaNodeSchema = z.object({
  id: z.string(),
  shortcode: z.string().optional(),
  __typename: z.string().optional(),
  product_type: z.string().optional(),
  display_url: z.string().optional(),
  thumbnail_src: z.string().optional(),
  is_video: z.boolean().optional(),
  video_view_count: z.number().optional(),
  video_play_count: z.number().nullable().optional(),
  taken_at_timestamp: z.number(),
  edge_liked_by: CountSchema.optional(),
  edge_media_preview_like: CountSchema.optional(),
  edge_media_to_comment: CountSchema.optional(),
  edge_media_to_caption: CaptionEdgesSchema.optional(),
  pinned_for_users: z.array(z.unknown()).optional(),
  dimensions: z.object({ width: z.number(), height: z.number() }).optional(),
  location: z.object({ name: z.string().optional() }).nullable().optional(),
  edge_sidecar_to_children: z
    .object({
      edges: z.array(
        z.object({
          node: z.object({
            id: z.string(),
            display_url: z.string().optional(),
            is_video: z.boolean().optional(),
          }),
        }),
      ),
    })
    .optional(),
});
export type PublicWebMediaNode = z.infer<typeof PublicWebMediaNodeSchema>;

export const PublicWebUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  full_name: z.string().optional().nullable(),
  biography: z.string().optional().nullable(),
  external_url: z.string().optional().nullable(),
  profile_pic_url: z.string().optional(),
  profile_pic_url_hd: z.string().optional(),
  is_private: z.boolean().optional(),
  is_verified: z.boolean().optional(),
  is_business_account: z.boolean().optional(),
  is_professional_account: z.boolean().optional(),
  category_name: z.string().optional().nullable(),
  edge_followed_by: CountSchema.optional(),
  edge_follow: CountSchema.optional(),
  edge_owner_to_timeline_media: z
    .object({
      count: z.number().optional(),
      page_info: z.object({ has_next_page: z.boolean().optional(), end_cursor: z.string().nullable().optional() }).optional(),
      edges: z.array(z.object({ node: PublicWebMediaNodeSchema })),
    })
    .optional(),
});
export type PublicWebUser = z.infer<typeof PublicWebUserSchema>;

export const PublicWebProfileResponseSchema = z.object({
  data: z.object({ user: PublicWebUserSchema.nullable() }),
  status: z.string().optional(),
});

/** Generic response of the SocialLens public-profile proxy (same payload as Instagram's). */
export const PublicProxyResponseSchema = z.union([
  PublicWebProfileResponseSchema,
  z.object({ error: z.string(), code: z.string().optional() }),
]);
