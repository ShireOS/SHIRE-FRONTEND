export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      calibration_import_sessions: {
        Row: {
          approved_at: string | null
          camera_source_id: string
          created_at: string
          created_by_user_id: string | null
          expires_at: string
          id: string
          raw_payload: Json
          reference_frame_height: number
          reference_frame_path: string | null
          reference_frame_width: number
          resolved_payload: Json
          restaurant_id: string
          status: string
          warnings: Json
        }
        Insert: {
          approved_at?: string | null
          camera_source_id: string
          created_at?: string
          created_by_user_id?: string | null
          expires_at?: string
          id?: string
          raw_payload: Json
          reference_frame_height: number
          reference_frame_path?: string | null
          reference_frame_width: number
          resolved_payload: Json
          restaurant_id: string
          status?: string
          warnings?: Json
        }
        Update: {
          approved_at?: string | null
          camera_source_id?: string
          created_at?: string
          created_by_user_id?: string | null
          expires_at?: string
          id?: string
          raw_payload?: Json
          reference_frame_height?: number
          reference_frame_path?: string | null
          reference_frame_width?: number
          resolved_payload?: Json
          restaurant_id?: string
          status?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "calibration_import_sessions_camera_source_id_fkey"
            columns: ["camera_source_id"]
            isOneToOne: false
            referencedRelation: "camera_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calibration_import_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_coverage_warnings: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by_user_id: string | null
          camera_source_id: string | null
          details: Json
          first_observed_at: string
          id: string
          last_observed_at: string
          resolved_at: string | null
          restaurant_id: string
          table_id: string | null
          warning_type: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          camera_source_id?: string | null
          details?: Json
          first_observed_at?: string
          id?: string
          last_observed_at?: string
          resolved_at?: string | null
          restaurant_id: string
          table_id?: string | null
          warning_type: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          camera_source_id?: string | null
          details?: Json
          first_observed_at?: string
          id?: string
          last_observed_at?: string
          resolved_at?: string | null
          restaurant_id?: string
          table_id?: string | null
          warning_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "camera_coverage_warnings_camera_source_id_fkey"
            columns: ["camera_source_id"]
            isOneToOne: false
            referencedRelation: "camera_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camera_coverage_warnings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camera_coverage_warnings_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_crop_state: {
        Row: {
          camera_id: string
          created_at: string | null
          crop_json: Json
          id: string
          is_active: boolean | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          camera_id: string
          created_at?: string | null
          crop_json: Json
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          camera_id?: string
          created_at?: string | null
          crop_json?: Json
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "camera_crop_state_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "camera_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_result_ingests: {
        Row: {
          attempts: number
          camera_delivery_id: string
          camera_id: string
          camera_semantic_key: string | null
          completed_at: string | null
          id: string
          last_error: string | null
          payload: Json
          received_at: string
          restaurant_id: string
          result: Json | null
          runpod_job_id: string | null
          started_at: string | null
          status: string
          triplet_index: number
        }
        Insert: {
          attempts?: number
          camera_delivery_id: string
          camera_id: string
          camera_semantic_key?: string | null
          completed_at?: string | null
          id?: string
          last_error?: string | null
          payload: Json
          received_at?: string
          restaurant_id: string
          result?: Json | null
          runpod_job_id?: string | null
          started_at?: string | null
          status?: string
          triplet_index: number
        }
        Update: {
          attempts?: number
          camera_delivery_id?: string
          camera_id?: string
          camera_semantic_key?: string | null
          completed_at?: string | null
          id?: string
          last_error?: string | null
          payload?: Json
          received_at?: string
          restaurant_id?: string
          result?: Json | null
          runpod_job_id?: string | null
          started_at?: string | null
          status?: string
          triplet_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "camera_result_ingests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_sources: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_frame_at: string | null
          location: string | null
          name: string
          restaurant_id: string
          stream_url: string | null
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_frame_at?: string | null
          location?: string | null
          name: string
          restaurant_id: string
          stream_url?: string | null
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_frame_at?: string | null
          location?: string | null
          name?: string
          restaurant_id?: string
          stream_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "camera_sources_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_dispatch_log: {
        Row: {
          camera_id: string | null
          created_at: string | null
          dispatch_status: string
          frame_timestamp: string | null
          id: string
          node_id: string | null
          processing_ms: number | null
          raw_camera_id: string | null
          reason: string | null
          restaurant_id: string | null
          results: Json | null
          tables_processed: number | null
        }
        Insert: {
          camera_id?: string | null
          created_at?: string | null
          dispatch_status?: string
          frame_timestamp?: string | null
          id?: string
          node_id?: string | null
          processing_ms?: number | null
          raw_camera_id?: string | null
          reason?: string | null
          restaurant_id?: string | null
          results?: Json | null
          tables_processed?: number | null
        }
        Update: {
          camera_id?: string | null
          created_at?: string | null
          dispatch_status?: string
          frame_timestamp?: string | null
          id?: string
          node_id?: string | null
          processing_ms?: number | null
          raw_camera_id?: string | null
          reason?: string | null
          restaurant_id?: string | null
          results?: Json | null
          tables_processed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crop_dispatch_log_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "camera_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_dispatch_log_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_forecasts: {
        Row: {
          actual_covers: number | null
          actual_parties: number | null
          confidence: number | null
          created_at: string | null
          day_of_week: number | null
          features_used: Json | null
          forecast_date: string
          hour_of_day: number | null
          id: string
          model_version: string | null
          predicted_covers: number | null
          predicted_parties: number | null
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          actual_covers?: number | null
          actual_parties?: number | null
          confidence?: number | null
          created_at?: string | null
          day_of_week?: number | null
          features_used?: Json | null
          forecast_date: string
          hour_of_day?: number | null
          id?: string
          model_version?: string | null
          predicted_covers?: number | null
          predicted_parties?: number | null
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          actual_covers?: number | null
          actual_parties?: number | null
          confidence?: number | null
          created_at?: string | null
          day_of_week?: number | null
          features_used?: Json | null
          forecast_date?: string
          hour_of_day?: number | null
          id?: string
          model_version?: string | null
          predicted_covers?: number | null
          predicted_parties?: number | null
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_forecasts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      differential_prediction_events: {
        Row: {
          created_at: string
          delivery_id: string | null
          engine_weight: number | null
          event_type: string
          evidence: Json
          group_key: string | null
          id: number
          restaurant_id: string
          score: number | null
          table_id: string
          tag: string
          threshold: number | null
          verdict: string | null
        }
        Insert: {
          created_at?: string
          delivery_id?: string | null
          engine_weight?: number | null
          event_type: string
          evidence?: Json
          group_key?: string | null
          id?: number
          restaurant_id: string
          score?: number | null
          table_id: string
          tag: string
          threshold?: number | null
          verdict?: string | null
        }
        Update: {
          created_at?: string
          delivery_id?: string | null
          engine_weight?: number | null
          event_type?: string
          evidence?: Json
          group_key?: string | null
          id?: number
          restaurant_id?: string
          score?: number | null
          table_id?: string
          tag?: string
          threshold?: number | null
          verdict?: string | null
        }
        Relationships: []
      }
      edge_camera_registry: {
        Row: {
          camera_id: string
          camera_name: string | null
          camera_source_id: string | null
          created_at: string
          disabled_at: string | null
          first_observed_at: string
          id: string
          last_observed_at: string
          metadata: Json
          node_id: string
          promoted_at: string | null
          restaurant_id: string | null
          site_id: string
          source: string
          state: string
          updated_at: string
        }
        Insert: {
          camera_id: string
          camera_name?: string | null
          camera_source_id?: string | null
          created_at?: string
          disabled_at?: string | null
          first_observed_at?: string
          id?: string
          last_observed_at?: string
          metadata?: Json
          node_id: string
          promoted_at?: string | null
          restaurant_id?: string | null
          site_id: string
          source?: string
          state?: string
          updated_at?: string
        }
        Update: {
          camera_id?: string
          camera_name?: string | null
          camera_source_id?: string | null
          created_at?: string
          disabled_at?: string | null
          first_observed_at?: string
          id?: string
          last_observed_at?: string
          metadata?: Json
          node_id?: string
          promoted_at?: string | null
          restaurant_id?: string | null
          site_id?: string
          source?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "edge_camera_registry_camera_source_id_fkey"
            columns: ["camera_source_id"]
            isOneToOne: false
            referencedRelation: "camera_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edge_camera_registry_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_node_claim_codes: {
        Row: {
          claimed_at: string | null
          claimed_node_id: string | null
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          restaurant_id: string
          site_id: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_node_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          restaurant_id: string
          site_id: string
        }
        Update: {
          claimed_at?: string | null
          claimed_node_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          restaurant_id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edge_node_claim_codes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_node_commands: {
        Row: {
          command_json: Json
          created_at: string
          delivered_at: string | null
          expires_at: string | null
          id: string
          node_id: string
          restaurant_id: string | null
          status: string
        }
        Insert: {
          command_json?: Json
          created_at?: string
          delivered_at?: string | null
          expires_at?: string | null
          id?: string
          node_id: string
          restaurant_id?: string | null
          status?: string
        }
        Update: {
          command_json?: Json
          created_at?: string
          delivered_at?: string | null
          expires_at?: string | null
          id?: string
          node_id?: string
          restaurant_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "edge_node_commands_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "edge_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "edge_node_commands_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_node_registry: {
        Row: {
          created_at: string
          first_claimed_at: string | null
          hostname: string | null
          last_heartbeat_at: string | null
          last_seen_at: string | null
          local_ip: string | null
          metadata: Json
          node_id: string
          restaurant_id: string | null
          site_id: string
          software_version: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_claimed_at?: string | null
          hostname?: string | null
          last_heartbeat_at?: string | null
          last_seen_at?: string | null
          local_ip?: string | null
          metadata?: Json
          node_id: string
          restaurant_id?: string | null
          site_id: string
          software_version?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_claimed_at?: string | null
          hostname?: string | null
          last_heartbeat_at?: string | null
          last_seen_at?: string | null
          local_ip?: string | null
          metadata?: Json
          node_id?: string
          restaurant_id?: string | null
          site_id?: string
          software_version?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "edge_node_registry_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_node_token_registry: {
        Row: {
          created_at: string
          node_id: string
          restaurant_id: string | null
          revoked_at: string | null
          site_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          node_id: string
          restaurant_id?: string | null
          revoked_at?: string | null
          site_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          node_id?: string
          restaurant_id?: string | null
          revoked_at?: string | null
          site_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "edge_node_token_registry_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_node_tokens: {
        Row: {
          created_at: string
          id: string
          node_id: string
          restaurant_id: string | null
          revoked_at: string | null
          site_id: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          node_id: string
          restaurant_id?: string | null
          revoked_at?: string | null
          site_id?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          node_id?: string
          restaurant_id?: string | null
          revoked_at?: string | null
          site_id?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "edge_node_tokens_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "edge_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "edge_node_tokens_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_nodes: {
        Row: {
          claimed_at: string | null
          created_at: string
          desired_config: Json
          discovered: Json
          heartbeat: Json
          hostname: string | null
          last_heartbeat: string | null
          last_seen: string | null
          local_ip: string | null
          node_id: string
          onboarding: Json
          restaurant_id: string | null
          site_id: string
          software_version: string | null
          status: Json
          updated_at: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          desired_config?: Json
          discovered?: Json
          heartbeat?: Json
          hostname?: string | null
          last_heartbeat?: string | null
          last_seen?: string | null
          local_ip?: string | null
          node_id: string
          onboarding?: Json
          restaurant_id?: string | null
          site_id: string
          software_version?: string | null
          status?: Json
          updated_at?: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          desired_config?: Json
          discovered?: Json
          heartbeat?: Json
          hostname?: string | null
          last_heartbeat?: string | null
          last_seen?: string | null
          local_ip?: string | null
          node_id?: string
          onboarding?: Json
          restaurant_id?: string | null
          site_id?: string
          software_version?: string | null
          status?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "edge_nodes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_request_balances: {
        Row: {
          created_at: string
          critical_priority_used: number
          high_priority_used: number
          id: string
          low_priority_used: number
          medium_priority_used: number
          normal_priority_used: number
          policy_year: number
          restaurant_id: string
          updated_at: string
          waiter_id: string
        }
        Insert: {
          created_at?: string
          critical_priority_used?: number
          high_priority_used?: number
          id?: string
          low_priority_used?: number
          medium_priority_used?: number
          normal_priority_used?: number
          policy_year?: number
          restaurant_id: string
          updated_at?: string
          waiter_id: string
        }
        Update: {
          created_at?: string
          critical_priority_used?: number
          high_priority_used?: number
          id?: string
          low_priority_used?: number
          medium_priority_used?: number
          normal_priority_used?: number
          policy_year?: number
          restaurant_id?: string
          updated_at?: string
          waiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_request_balances_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_request_balances_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_request_policies: {
        Row: {
          created_at: string
          critical_priority_limit: number
          high_priority_limit: number
          id: string
          low_priority_limit: number | null
          manager_settings: Json
          medium_priority_limit: number
          normal_priority_limit: number
          policy_year: number
          reset_timezone: string
          restaurant_id: string
          rules: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          critical_priority_limit?: number
          high_priority_limit?: number
          id?: string
          low_priority_limit?: number | null
          manager_settings?: Json
          medium_priority_limit?: number
          normal_priority_limit?: number
          policy_year?: number
          reset_timezone?: string
          restaurant_id: string
          rules?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          critical_priority_limit?: number
          high_priority_limit?: number
          id?: string
          low_priority_limit?: number | null
          manager_settings?: Json
          medium_priority_limit?: number
          normal_priority_limit?: number
          policy_year?: number
          reset_timezone?: string
          restaurant_id?: string
          rules?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_request_policies_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_time_requests: {
        Row: {
          confidence: number | null
          counts_against_quota: boolean
          created_at: string
          day_of_week: number | null
          end_date: string | null
          end_time: string | null
          id: string
          is_hard_constraint: boolean
          manager_note_id: string | null
          notes: string | null
          parsed_status: string
          policy_year: number
          priority: string
          priority_score: number | null
          request_type: string
          restaurant_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          start_date: string | null
          start_time: string | null
          status: string
          structured_payload: Json
          title: string | null
          updated_at: string
          waiter_id: string
        }
        Insert: {
          confidence?: number | null
          counts_against_quota?: boolean
          created_at?: string
          day_of_week?: number | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          is_hard_constraint?: boolean
          manager_note_id?: string | null
          notes?: string | null
          parsed_status?: string
          policy_year?: number
          priority?: string
          priority_score?: number | null
          request_type?: string
          restaurant_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          start_date?: string | null
          start_time?: string | null
          status?: string
          structured_payload?: Json
          title?: string | null
          updated_at?: string
          waiter_id: string
        }
        Update: {
          confidence?: number | null
          counts_against_quota?: boolean
          created_at?: string
          day_of_week?: number | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          is_hard_constraint?: boolean
          manager_note_id?: string | null
          notes?: string | null
          parsed_status?: string
          policy_year?: number
          priority?: string
          priority_score?: number | null
          request_type?: string
          restaurant_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          start_date?: string | null
          start_time?: string | null
          status?: string
          structured_payload?: Json
          title?: string | null
          updated_at?: string
          waiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_time_requests_manager_note_fk"
            columns: ["manager_note_id"]
            isOneToOne: false
            referencedRelation: "schedule_constraint_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_time_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_time_requests_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      extracted_frames: {
        Row: {
          created_at: string | null
          file_path: string
          frame_index: number
          id: string
          job_id: string
          timestamp_seconds: number | null
        }
        Insert: {
          created_at?: string | null
          file_path: string
          frame_index: number
          id?: string
          job_id: string
          timestamp_seconds?: number | null
        }
        Update: {
          created_at?: string | null
          file_path?: string
          frame_index?: number
          id?: string
          job_id?: string
          timestamp_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "extracted_frames_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "video_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_device_layouts: {
        Row: {
          created_at: string
          device_id: string | null
          device_label: string | null
          floor_id: string
          id: string
          is_profile_default: boolean
          layout_data: Json
          location_id: string
          map_version: string | null
          profile_key: string
          surface: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          device_label?: string | null
          floor_id: string
          id: string
          is_profile_default?: boolean
          layout_data: Json
          location_id: string
          map_version?: string | null
          profile_key: string
          surface?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          device_label?: string | null
          floor_id?: string
          id?: string
          is_profile_default?: boolean
          layout_data?: Json
          location_id?: string
          map_version?: string | null
          profile_key?: string
          surface?: string
          updated_at?: string
        }
        Relationships: []
      }
      floor_maps: {
        Row: {
          created_at: string
          floor_id: string
          id: string
          location_id: string
          map_data: Json
          map_version: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          floor_id: string
          id?: string
          location_id: string
          map_data: Json
          map_version: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          floor_id?: string
          id?: string
          location_id?: string
          map_data?: Json
          map_version?: string
          updated_at?: string
        }
        Relationships: []
      }
      floor_realtime_cursors: {
        Row: {
          current_sequence: number
          floor_id: string
          updated_at: string | null
        }
        Insert: {
          current_sequence?: number
          floor_id: string
          updated_at?: string | null
        }
        Update: {
          current_sequence?: number
          floor_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      floor_realtime_events: {
        Row: {
          actor_user_id: string | null
          command_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          floor_id: string
          id: string
          payload: Json
          restaurant_id: string
          sequence: number
        }
        Insert: {
          actor_user_id?: string | null
          command_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          floor_id: string
          id?: string
          payload?: Json
          restaurant_id: string
          sequence: number
        }
        Update: {
          actor_user_id?: string | null
          command_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          floor_id?: string
          id?: string
          payload?: Json
          restaurant_id?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "floor_realtime_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      flywheel_sample_log: {
        Row: {
          created_at: string
          episode_started_at: string | null
          id: string
          restaurant_id: string
          sampled_at: string
          state: string | null
          stream: string
          table_id: string
        }
        Insert: {
          created_at?: string
          episode_started_at?: string | null
          id?: string
          restaurant_id: string
          sampled_at?: string
          state?: string | null
          stream: string
          table_id: string
        }
        Update: {
          created_at?: string
          episode_started_at?: string | null
          id?: string
          restaurant_id?: string
          sampled_at?: string
          state?: string | null
          stream?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flywheel_sample_log_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flywheel_sample_log_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      frame_classifications: {
        Row: {
          confidence: number
          created_at: string | null
          frame_id: string | null
          frame_index: number
          id: string
          job_id: string
          predicted_state: string
          probabilities: Json | null
          smoothed_state: string | null
          table_number: string
        }
        Insert: {
          confidence: number
          created_at?: string | null
          frame_id?: string | null
          frame_index: number
          id?: string
          job_id: string
          predicted_state: string
          probabilities?: Json | null
          smoothed_state?: string | null
          table_number: string
        }
        Update: {
          confidence?: number
          created_at?: string | null
          frame_id?: string | null
          frame_index?: number
          id?: string
          job_id?: string
          predicted_state?: string
          probabilities?: Json | null
          smoothed_state?: string | null
          table_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "frame_classifications_frame_id_fkey"
            columns: ["frame_id"]
            isOneToOne: false
            referencedRelation: "extracted_frames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_classifications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "video_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_conversations: {
        Row: {
          active_reservation_id: string | null
          active_waitlist_id: string | null
          archived_at: string | null
          created_at: string
          display_name: string | null
          guest_id: string | null
          id: string
          last_message_at: string | null
          last_message_id: string | null
          last_message_preview: string | null
          organization_id: string
          phone_e164: string | null
          phone_last4: string | null
          restaurant_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          active_reservation_id?: string | null
          active_waitlist_id?: string | null
          archived_at?: string | null
          created_at?: string
          display_name?: string | null
          guest_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_id?: string | null
          last_message_preview?: string | null
          organization_id: string
          phone_e164?: string | null
          phone_last4?: string | null
          restaurant_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          active_reservation_id?: string | null
          active_waitlist_id?: string | null
          archived_at?: string | null
          created_at?: string
          display_name?: string | null
          guest_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_id?: string | null
          last_message_preview?: string | null
          organization_id?: string
          phone_e164?: string | null
          phone_last4?: string | null
          restaurant_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_conversations_active_reservation_id_fkey"
            columns: ["active_reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_conversations_active_waitlist_id_fkey"
            columns: ["active_waitlist_id"]
            isOneToOne: false
            referencedRelation: "waitlist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_conversations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_conversations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_messages: {
        Row: {
          actor_user_id: string | null
          body: string
          channel: string
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: string
          error_message: string | null
          guest_id: string | null
          id: string
          provider: string | null
          provider_message_id: string | null
          provider_payload: Json
          read_at: string | null
          reservation_id: string | null
          restaurant_id: string
          sent_at: string | null
          status: string
          template_id: string | null
          template_key: string | null
          updated_at: string
          waitlist_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          body: string
          channel?: string
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction: string
          error_message?: string | null
          guest_id?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          provider_payload?: Json
          read_at?: string | null
          reservation_id?: string | null
          restaurant_id: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
          template_key?: string | null
          updated_at?: string
          waitlist_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          body?: string
          channel?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          guest_id?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          provider_payload?: Json
          read_at?: string | null
          reservation_id?: string | null
          restaurant_id?: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
          template_key?: string | null
          updated_at?: string
          waitlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "guest_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_messages_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_messages_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_messages_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_messages_waitlist_id_fkey"
            columns: ["waitlist_id"]
            isOneToOne: false
            referencedRelation: "waitlist"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          created_at: string
          email: string | null
          email_normalized: string | null
          full_name: string
          id: string
          marketing_consent: boolean
          organization_id: string
          phone_e164: string | null
          phone_last4: string | null
          sms_opt_out: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          email_normalized?: string | null
          full_name: string
          id?: string
          marketing_consent?: boolean
          organization_id: string
          phone_e164?: string | null
          phone_last4?: string | null
          sms_opt_out?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          email_normalized?: string | null
          full_name?: string
          id?: string
          marketing_consent?: boolean
          organization_id?: string
          phone_e164?: string | null
          phone_last4?: string | null
          sms_opt_out?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      host_action_commands: {
        Row: {
          action: string
          after_payload: Json
          before_payload: Json
          command_id: string
          created_at: string
          created_by_user_id: string | null
          id: string
          request_fingerprint: string
          resource_id: string
          resource_type: string
          response_payload: Json
          restaurant_id: string
          undo_payload: Json
          undoable: boolean
          undone_at: string | null
          undone_by_user_id: string | null
          updated_at: string
        }
        Insert: {
          action: string
          after_payload?: Json
          before_payload?: Json
          command_id: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          request_fingerprint: string
          resource_id: string
          resource_type: string
          response_payload?: Json
          restaurant_id: string
          undo_payload?: Json
          undoable?: boolean
          undone_at?: string | null
          undone_by_user_id?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          after_payload?: Json
          before_payload?: Json
          command_id?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          request_fingerprint?: string
          resource_id?: string
          resource_type?: string
          response_payload?: Json
          restaurant_id?: string
          undo_payload?: Json
          undoable?: boolean
          undone_at?: string | null
          undone_by_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_action_commands_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      host_floor_maps: {
        Row: {
          cctv_reminder_disabled: boolean
          created_at: string | null
          floor_id: string
          floor_map_json: Json
          id: string
          last_clean_reset_local_date: string | null
          map_version: number
          mode_changed_at: string | null
          restaurant_id: string
          table_state_mode: string
          updated_at: string | null
        }
        Insert: {
          cctv_reminder_disabled?: boolean
          created_at?: string | null
          floor_id?: string
          floor_map_json?: Json
          id?: string
          last_clean_reset_local_date?: string | null
          map_version?: number
          mode_changed_at?: string | null
          restaurant_id: string
          table_state_mode?: string
          updated_at?: string | null
        }
        Update: {
          cctv_reminder_disabled?: boolean
          created_at?: string | null
          floor_id?: string
          floor_map_json?: Json
          id?: string
          last_clean_reset_local_date?: string | null
          map_version?: number
          mode_changed_at?: string | null
          restaurant_id?: string
          table_state_mode?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "host_floor_maps_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      host_user_location_memberships: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean
          organization_id: string
          permissions: Json
          restaurant_id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean
          organization_id: string
          permissions?: Json
          restaurant_id: string
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean
          organization_id?: string
          permissions?: Json
          restaurant_id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_user_location_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "host_user_location_memberships_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      host_waiter_routing: {
        Row: {
          active_waiter_ids: Json
          created_at: string
          grat_rotation_state: Json
          grat_threshold: number
          mode: string
          next_waiter_id: string | null
          restaurant_id: string
          rotation_order: Json
          section_assignments: Json
          setup_approved_at: string | null
          setup_approved_by_user_id: string | null
          setup_planned_mode: string | null
          setup_section_plan_id: string | null
          setup_service_date: string | null
          setup_starting_mode: string | null
          shift_start_groups: Json
          table_assignments: Json
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          active_waiter_ids?: Json
          created_at?: string
          grat_rotation_state?: Json
          grat_threshold?: number
          mode?: string
          next_waiter_id?: string | null
          restaurant_id: string
          rotation_order?: Json
          section_assignments?: Json
          setup_approved_at?: string | null
          setup_approved_by_user_id?: string | null
          setup_planned_mode?: string | null
          setup_section_plan_id?: string | null
          setup_service_date?: string | null
          setup_starting_mode?: string | null
          shift_start_groups?: Json
          table_assignments?: Json
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          active_waiter_ids?: Json
          created_at?: string
          grat_rotation_state?: Json
          grat_threshold?: number
          mode?: string
          next_waiter_id?: string | null
          restaurant_id?: string
          rotation_order?: Json
          section_assignments?: Json
          setup_approved_at?: string | null
          setup_approved_by_user_id?: string | null
          setup_planned_mode?: string | null
          setup_section_plan_id?: string | null
          setup_service_date?: string | null
          setup_starting_mode?: string | null
          shift_start_groups?: Json
          table_assignments?: Json
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "host_waiter_routing_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      image_annotations: {
        Row: {
          annotation_state: Database["public"]["Enums"]["annotation_state"][]
          assigned_annotator: string[] | null
          audit_metadata: Json
          audit_note: string | null
          audit_previous_state:
            | Database["public"]["Enums"]["annotation_state"]
            | null
          audit_source: string | null
          audit_state: Database["public"]["Enums"]["image_annotation_audit_state"]
          audited: boolean
          audited_at: string | null
          audited_by: string | null
          camera_id: string
          captured_at: string | null
          cloud_img_link: string | null
          created_at: string
          date_annotated: string | null
          dino_annotation: boolean
          full_10_artifact_uri: string | null
          id: string
          legacy: boolean
          next_interval_id: string | null
          prev_interval_id: string | null
          primary_annotator: boolean
          raw_window_uri: string | null
          restaurant_id: string
          sample_index: string
          stream_metadata: Json
          stream_sequence: number | null
          table_id: string | null
          timestamp_audit: boolean
          updated_at: string
          uuid: string
        }
        Insert: {
          annotation_state?: Database["public"]["Enums"]["annotation_state"][]
          assigned_annotator?: string[] | null
          audit_metadata?: Json
          audit_note?: string | null
          audit_previous_state?:
            | Database["public"]["Enums"]["annotation_state"]
            | null
          audit_source?: string | null
          audit_state?: Database["public"]["Enums"]["image_annotation_audit_state"]
          audited?: boolean
          audited_at?: string | null
          audited_by?: string | null
          camera_id: string
          captured_at?: string | null
          cloud_img_link?: string | null
          created_at?: string
          date_annotated?: string | null
          dino_annotation?: boolean
          full_10_artifact_uri?: string | null
          id: string
          legacy?: boolean
          next_interval_id?: string | null
          prev_interval_id?: string | null
          primary_annotator?: boolean
          raw_window_uri?: string | null
          restaurant_id: string
          sample_index: string
          stream_metadata?: Json
          stream_sequence?: number | null
          table_id?: string | null
          timestamp_audit?: boolean
          updated_at?: string
          uuid?: string
        }
        Update: {
          annotation_state?: Database["public"]["Enums"]["annotation_state"][]
          assigned_annotator?: string[] | null
          audit_metadata?: Json
          audit_note?: string | null
          audit_previous_state?:
            | Database["public"]["Enums"]["annotation_state"]
            | null
          audit_source?: string | null
          audit_state?: Database["public"]["Enums"]["image_annotation_audit_state"]
          audited?: boolean
          audited_at?: string | null
          audited_by?: string | null
          camera_id?: string
          captured_at?: string | null
          cloud_img_link?: string | null
          created_at?: string
          date_annotated?: string | null
          dino_annotation?: boolean
          full_10_artifact_uri?: string | null
          id?: string
          legacy?: boolean
          next_interval_id?: string | null
          prev_interval_id?: string | null
          primary_annotator?: boolean
          raw_window_uri?: string | null
          restaurant_id?: string
          sample_index?: string
          stream_metadata?: Json
          stream_sequence?: number | null
          table_id?: string | null
          timestamp_audit?: boolean
          updated_at?: string
          uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_annotations_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "camera_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_annotations_next_interval_id_fkey"
            columns: ["next_interval_id"]
            isOneToOne: false
            referencedRelation: "image_annotations"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "image_annotations_prev_interval_id_fkey"
            columns: ["prev_interval_id"]
            isOneToOne: false
            referencedRelation: "image_annotations"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "image_annotations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_annotations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          category: string
          cost_per_unit: number
          created_at: string | null
          current_stock: number | null
          id: string
          name: string
          par_level: number
          restaurant_id: string
          supplier: string
          unit: string
          updated_at: string | null
        }
        Insert: {
          category: string
          cost_per_unit: number
          created_at?: string | null
          current_stock?: number | null
          id?: string
          name: string
          par_level: number
          restaurant_id: string
          supplier: string
          unit: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          cost_per_unit?: number
          created_at?: string | null
          current_stock?: number | null
          id?: string
          name?: string
          par_level?: number
          restaurant_id?: string
          supplier?: string
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_providers: {
        Row: {
          auth_type: string
          category: string
          created_at: string | null
          icon_url: string | null
          id: string
          is_active: boolean | null
          name: string
          oauth_config: Json | null
          slug: string
          sync_config: Json | null
        }
        Insert: {
          auth_type: string
          category: string
          created_at?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          oauth_config?: Json | null
          slug: string
          sync_config?: Json | null
        }
        Update: {
          auth_type?: string
          category?: string
          created_at?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          oauth_config?: Json | null
          slug?: string
          sync_config?: Json | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          access_token_encrypted: string | null
          connected_at: string | null
          created_at: string | null
          external_id: string | null
          id: string
          last_synced_at: string | null
          provider: string
          provider_data: Json | null
          refresh_token_encrypted: string | null
          restaurant_id: string
          scopes: string[] | null
          status: string | null
          sync_error: string | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          created_at?: string | null
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          provider: string
          provider_data?: Json | null
          refresh_token_encrypted?: string | null
          restaurant_id: string
          scopes?: string[] | null
          status?: string | null
          sync_error?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          created_at?: string | null
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          provider_data?: Json | null
          refresh_token_encrypted?: string | null
          restaurant_id?: string
          scopes?: string[] | null
          status?: string | null
          sync_error?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          restaurant_id: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          restaurant_id: string
          role?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          restaurant_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          input_data: Json | null
          job_type: string
          restaurant_id: string
          result_data: Json | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          input_data?: Json | null
          job_type: string
          restaurant_id: string
          result_data?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          input_data?: Json | null
          job_type?: string
          restaurant_id?: string
          result_data?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_output_targets: {
        Row: {
          archived_at: string | null
          config: Json
          connection_type: string
          created_at: string
          id: string
          is_active: boolean
          last_test_error: string | null
          last_test_status: string | null
          last_tested_at: string | null
          name: string
          pos_device_id: string | null
          restaurant_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          config?: Json
          connection_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_test_error?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          name: string
          pos_device_id?: string | null
          restaurant_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          config?: Json
          connection_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_test_error?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          name?: string
          pos_device_id?: string | null
          restaurant_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_output_targets_pos_device_id_fkey"
            columns: ["pos_device_id"]
            isOneToOne: false
            referencedRelation: "pos_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_output_targets_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_routing_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          object_id: string | null
          object_type: string
          restaurant_id: string
          source: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          object_id?: string | null
          object_type: string
          restaurant_id: string
          source?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          object_id?: string | null
          object_type?: string
          restaurant_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_routing_audit_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_routing_rules: {
        Row: {
          archived_at: string | null
          category: string | null
          course_name: string | null
          created_at: string
          id: string
          is_active: boolean
          priority: number
          restaurant_id: string
          source_id: string | null
          source_type: string
          station_id: string
          target_types: string[]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          course_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          restaurant_id: string
          source_id?: string | null
          source_type: string
          station_id: string
          target_types?: string[]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          course_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          restaurant_id?: string
          source_id?: string | null
          source_type?: string
          station_id?: string
          target_types?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_routing_rules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_routing_rules_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "kitchen_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_station_targets: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          is_active: boolean
          priority: number
          restaurant_id: string
          station_id: string
          target_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          restaurant_id: string
          station_id: string
          target_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          restaurant_id?: string
          station_id?: string
          target_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_station_targets_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_station_targets_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "kitchen_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_station_targets_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "kitchen_output_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_stations: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean | null
          is_fallback: boolean
          max_concurrent_orders: number | null
          name: string
          restaurant_id: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean | null
          is_fallback?: boolean
          max_concurrent_orders?: number | null
          name: string
          restaurant_id: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean | null
          is_fallback?: boolean
          max_concurrent_orders?: number | null
          name?: string
          restaurant_id?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_stations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_ticket_batches: {
        Row: {
          course_name: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          id: string
          idempotency_key: string
          kitchen_notes: string | null
          order_id: string
          requested_item_ids: string[]
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          course_name?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          idempotency_key: string
          kitchen_notes?: string | null
          order_id: string
          requested_item_ids?: string[]
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          course_name?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          idempotency_key?: string
          kitchen_notes?: string | null
          order_id?: string
          requested_item_ids?: string[]
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_ticket_batches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_ticket_batches_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_ticket_deliveries: {
        Row: {
          attempt_count: number
          batch_id: string
          created_at: string
          delivered_at: string | null
          id: string
          last_error: string | null
          restaurant_id: string
          station_id: string
          status: string
          target_id: string
          ticket_payload: Json
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          batch_id: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          last_error?: string | null
          restaurant_id: string
          station_id: string
          status?: string
          target_id: string
          ticket_payload?: Json
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          batch_id?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          last_error?: string | null
          restaurant_id?: string
          station_id?: string
          status?: string
          target_id?: string
          ticket_payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_ticket_deliveries_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "kitchen_ticket_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_ticket_deliveries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_ticket_deliveries_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "kitchen_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_ticket_deliveries_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "kitchen_output_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_parse_runs: {
        Row: {
          completed_at: string | null
          cost_cents: number | null
          created_at: string
          error_message: string | null
          id: string
          model: string | null
          parsed_payload: Json
          prompt_type: string
          raw_text: string
          restaurant_id: string
          source: string
          status: string
          tokens_used: number | null
          waiter_id: string | null
        }
        Insert: {
          completed_at?: string | null
          cost_cents?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          model?: string | null
          parsed_payload?: Json
          prompt_type?: string
          raw_text: string
          restaurant_id: string
          source?: string
          status?: string
          tokens_used?: number | null
          waiter_id?: string | null
        }
        Update: {
          completed_at?: string | null
          cost_cents?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          model?: string | null
          parsed_payload?: Json
          prompt_type?: string
          raw_text?: string
          restaurant_id?: string
          source?: string
          status?: string
          tokens_used?: number | null
          waiter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_parse_runs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_parse_runs_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          archived_at: string | null
          category: string | null
          cost: number | null
          created_at: string | null
          description: string | null
          id: string
          is_available: boolean | null
          name: string
          pos_item_id: string | null
          price: number | null
          restaurant_id: string
          routing_confirmed_at: string | null
          routing_confirmed_by: string | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_available?: boolean | null
          name: string
          pos_item_id?: string | null
          price?: number | null
          restaurant_id: string
          routing_confirmed_at?: string | null
          routing_confirmed_by?: string | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_available?: boolean | null
          name?: string
          pos_item_id?: string | null
          price?: number | null
          restaurant_id?: string
          routing_confirmed_at?: string | null
          routing_confirmed_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_modifier_group_items: {
        Row: {
          display_order: number
          group_id: string
          item_id: string
        }
        Insert: {
          display_order?: number
          group_id: string
          item_id: string
        }
        Update: {
          display_order?: number
          group_id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_modifier_group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "menu_modifier_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_modifier_group_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_modifier_group_options: {
        Row: {
          display_order: number
          group_id: string
          is_default: boolean
          modifier_id: string
        }
        Insert: {
          display_order?: number
          group_id: string
          is_default?: boolean
          modifier_id: string
        }
        Update: {
          display_order?: number
          group_id?: string
          is_default?: boolean
          modifier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_modifier_group_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "menu_modifier_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_modifier_group_options_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "menu_modifiers"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_modifier_groups: {
        Row: {
          archived_at: string | null
          created_at: string
          display_order: number
          id: string
          is_available: boolean
          is_required: boolean
          max_selections: number | null
          min_selections: number
          name: string
          prompt_on_order: boolean
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_available?: boolean
          is_required?: boolean
          max_selections?: number | null
          min_selections?: number
          name: string
          prompt_on_order?: boolean
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_available?: boolean
          is_required?: boolean
          max_selections?: number | null
          min_selections?: number
          name?: string
          prompt_on_order?: boolean
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_modifier_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_modifier_items: {
        Row: {
          item_id: string
          modifier_id: string
        }
        Insert: {
          item_id: string
          modifier_id: string
        }
        Update: {
          item_id?: string
          modifier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_modifier_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_modifier_items_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "menu_modifiers"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_modifiers: {
        Row: {
          archived_at: string | null
          created_at: string | null
          id: string
          is_available: boolean
          name: string
          price_delta: number
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          id?: string
          is_available?: boolean
          name: string
          price_delta?: number
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          id?: string
          is_available?: boolean
          name?: string
          price_delta?: number
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_modifiers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_deliveries: {
        Row: {
          conversation_id: string | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          guest_id: string | null
          guest_message_id: string | null
          id: string
          message_type: string
          payload: Json
          provider: string | null
          provider_message_id: string | null
          reservation_id: string | null
          restaurant_id: string
          status: string
          waitlist_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          guest_id?: string | null
          guest_message_id?: string | null
          id?: string
          message_type: string
          payload?: Json
          provider?: string | null
          provider_message_id?: string | null
          reservation_id?: string | null
          restaurant_id: string
          status?: string
          waitlist_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          guest_id?: string | null
          guest_message_id?: string | null
          id?: string
          message_type?: string
          payload?: Json
          provider?: string | null
          provider_message_id?: string | null
          reservation_id?: string | null
          restaurant_id?: string
          status?: string
          waitlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_deliveries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "guest_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_guest_message_id_fkey"
            columns: ["guest_message_id"]
            isOneToOne: false
            referencedRelation: "guest_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_waitlist_id_fkey"
            columns: ["waitlist_id"]
            isOneToOne: false
            referencedRelation: "waitlist"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          active: boolean
          body: string
          category: string
          channel: string
          created_at: string
          created_by_user_id: string | null
          id: string
          key: string
          name: string
          restaurant_id: string
          system_default: boolean
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          active?: boolean
          body: string
          category: string
          channel?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          key: string
          name: string
          restaurant_id: string
          system_default?: boolean
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          active?: boolean
          body?: string
          category?: string
          channel?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          key?: string
          name?: string
          restaurant_id?: string
          system_default?: boolean
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      operating_hours: {
        Row: {
          close_time: string | null
          day_of_week: number
          id: string
          is_closed: boolean | null
          open_time: string | null
          restaurant_id: string
        }
        Insert: {
          close_time?: string | null
          day_of_week: number
          id?: string
          is_closed?: boolean | null
          open_time?: string | null
          restaurant_id: string
        }
        Update: {
          close_time?: string | null
          day_of_week?: number
          id?: string
          is_closed?: boolean | null
          open_time?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operating_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          menu_item_id: string
          modifiers: Json | null
          ordered_at: string | null
          quantity: number | null
          total_price: number | null
          unit_price: number | null
          visit_id: string
        }
        Insert: {
          id?: string
          menu_item_id: string
          modifiers?: Json | null
          ordered_at?: string | null
          quantity?: number | null
          total_price?: number | null
          unit_price?: number | null
          visit_id: string
        }
        Update: {
          id?: string
          menu_item_id?: string
          modifiers?: Json | null
          ordered_at?: string | null
          quantity?: number | null
          total_price?: number | null
          unit_price?: number | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      outbox_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          attempts: number
          available_at: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          attempts?: number
          available_at?: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          attempts?: number
          available_at?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_daily_closes: {
        Row: {
          business_date: string
          closed_at: string
          closed_by: string | null
          closed_by_name: string | null
          id: string
          notes: string | null
          restaurant_id: string
          totals: Json
        }
        Insert: {
          business_date: string
          closed_at?: string
          closed_by?: string | null
          closed_by_name?: string | null
          id?: string
          notes?: string | null
          restaurant_id: string
          totals: Json
        }
        Update: {
          business_date?: string
          closed_at?: string
          closed_by?: string | null
          closed_by_name?: string | null
          id?: string
          notes?: string | null
          restaurant_id?: string
          totals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pos_daily_closes_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_daily_closes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_devices: {
        Row: {
          active_layout_profile_id: string | null
          assigned_terminal_id: string | null
          created_at: string
          device_type: string
          id: string
          last_seen_at: string | null
          layout_preferences: Json
          layout_profile: string
          name: string
          paired_by: string | null
          restaurant_id: string
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          active_layout_profile_id?: string | null
          assigned_terminal_id?: string | null
          created_at?: string
          device_type?: string
          id?: string
          last_seen_at?: string | null
          layout_preferences?: Json
          layout_profile?: string
          name: string
          paired_by?: string | null
          restaurant_id: string
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          active_layout_profile_id?: string | null
          assigned_terminal_id?: string | null
          created_at?: string
          device_type?: string
          id?: string
          last_seen_at?: string | null
          layout_preferences?: Json
          layout_profile?: string
          name?: string
          paired_by?: string | null
          restaurant_id?: string
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_devices_active_layout_profile_id_fkey"
            columns: ["active_layout_profile_id"]
            isOneToOne: false
            referencedRelation: "pos_layout_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_devices_assigned_terminal_id_fkey"
            columns: ["assigned_terminal_id"]
            isOneToOne: false
            referencedRelation: "pos_helcim_terminals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_devices_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_discount_definitions: {
        Row: {
          auto_apply: boolean
          created_at: string
          discount_type: string
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          requires_manager: boolean
          restaurant_id: string
          scope: string
          starts_at: string | null
          updated_at: string
          value: number
        }
        Insert: {
          auto_apply?: boolean
          created_at?: string
          discount_type: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          requires_manager?: boolean
          restaurant_id: string
          scope?: string
          starts_at?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          auto_apply?: boolean
          created_at?: string
          discount_type?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          requires_manager?: boolean
          restaurant_id?: string
          scope?: string
          starts_at?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      pos_gift_cards: {
        Row: {
          balance: number
          code: string
          created_at: string
          id: string
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          balance?: number
          code: string
          created_at?: string
          id?: string
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          code?: string
          created_at?: string
          id?: string
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pos_handoff_corrections: {
        Row: {
          correction_reason: string | null
          created_at: string
          id: string
          new_party_size: number
          new_shift_id: string
          new_waiter_id: string
          previous_party_size: number
          previous_shift_id: string
          previous_waiter_id: string
          restaurant_id: string
          source_command_id: string | null
          undone_at: string | null
          updated_at: string
          visit_id: string
        }
        Insert: {
          correction_reason?: string | null
          created_at?: string
          id?: string
          new_party_size: number
          new_shift_id: string
          new_waiter_id: string
          previous_party_size: number
          previous_shift_id: string
          previous_waiter_id: string
          restaurant_id: string
          source_command_id?: string | null
          undone_at?: string | null
          updated_at?: string
          visit_id: string
        }
        Update: {
          correction_reason?: string | null
          created_at?: string
          id?: string
          new_party_size?: number
          new_shift_id?: string
          new_waiter_id?: string
          previous_party_size?: number
          previous_shift_id?: string
          previous_waiter_id?: string
          restaurant_id?: string
          source_command_id?: string | null
          undone_at?: string | null
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_handoff_corrections_new_shift_id_fkey"
            columns: ["new_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_handoff_corrections_new_waiter_id_fkey"
            columns: ["new_waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_handoff_corrections_previous_shift_id_fkey"
            columns: ["previous_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_handoff_corrections_previous_waiter_id_fkey"
            columns: ["previous_waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_handoff_corrections_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_handoff_corrections_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_helcim_terminals: {
        Row: {
          created_at: string
          helcim_device_code: string
          id: string
          is_default: boolean
          name: string
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          helcim_device_code: string
          id?: string
          is_default?: boolean
          name: string
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          helcim_device_code?: string
          id?: string
          is_default?: boolean
          name?: string
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_helcim_terminals_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_host_handoffs: {
        Row: {
          assigned_waiter_id: string | null
          assigned_waiter_name: string | null
          correction_reason: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          linked_order_id: string | null
          opened_at: string | null
          party_size: number
          raw_payload: Json
          restaurant_id: string
          source_command_id: string | null
          source_id: string | null
          source_type: string
          status: string
          table_id: string
          table_number: string | null
          updated_at: string
          visit_id: string | null
        }
        Insert: {
          assigned_waiter_id?: string | null
          assigned_waiter_name?: string | null
          correction_reason?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          linked_order_id?: string | null
          opened_at?: string | null
          party_size: number
          raw_payload?: Json
          restaurant_id: string
          source_command_id?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          table_id: string
          table_number?: string | null
          updated_at?: string
          visit_id?: string | null
        }
        Update: {
          assigned_waiter_id?: string | null
          assigned_waiter_name?: string | null
          correction_reason?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          linked_order_id?: string | null
          opened_at?: string | null
          party_size?: number
          raw_payload?: Json
          restaurant_id?: string
          source_command_id?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          table_id?: string
          table_number?: string | null
          updated_at?: string
          visit_id?: string | null
        }
        Relationships: []
      }
      pos_layout_profiles: {
        Row: {
          base_floor_id: string | null
          base_map_version: number | null
          created_at: string
          id: string
          is_default: boolean
          layout_overrides: Json
          name: string
          restaurant_id: string
          room_filters: string[]
          section_filters: string[]
          updated_at: string
        }
        Insert: {
          base_floor_id?: string | null
          base_map_version?: number | null
          created_at?: string
          id?: string
          is_default?: boolean
          layout_overrides?: Json
          name: string
          restaurant_id: string
          room_filters?: string[]
          section_filters?: string[]
          updated_at?: string
        }
        Update: {
          base_floor_id?: string | null
          base_map_version?: number | null
          created_at?: string
          id?: string
          is_default?: boolean
          layout_overrides?: Json
          name?: string
          restaurant_id?: string
          room_filters?: string[]
          section_filters?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_layout_profiles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_offline_conflicts: {
        Row: {
          client_mutation_id: string
          client_order_id: string | null
          conflict_type: string
          created_at: string
          detail: Json
          device_id: string
          id: string
          order_id: string | null
          resolved_at: string | null
          restaurant_id: string
          status: string
          table_id: string | null
        }
        Insert: {
          client_mutation_id: string
          client_order_id?: string | null
          conflict_type: string
          created_at?: string
          detail?: Json
          device_id: string
          id?: string
          order_id?: string | null
          resolved_at?: string | null
          restaurant_id: string
          status?: string
          table_id?: string | null
        }
        Update: {
          client_mutation_id?: string
          client_order_id?: string | null
          conflict_type?: string
          created_at?: string
          detail?: Json
          device_id?: string
          id?: string
          order_id?: string | null
          resolved_at?: string | null
          restaurant_id?: string
          status?: string
          table_id?: string | null
        }
        Relationships: []
      }
      pos_offline_mutations: {
        Row: {
          applied_at: string | null
          client_mutation_id: string
          created_at: string
          device_id: string
          error: Json | null
          id: string
          mutation_type: string
          payload: Json
          restaurant_id: string
          result: Json | null
          status: string
        }
        Insert: {
          applied_at?: string | null
          client_mutation_id: string
          created_at?: string
          device_id: string
          error?: Json | null
          id?: string
          mutation_type: string
          payload?: Json
          restaurant_id: string
          result?: Json | null
          status?: string
        }
        Update: {
          applied_at?: string | null
          client_mutation_id?: string
          created_at?: string
          device_id?: string
          error?: Json | null
          id?: string
          mutation_type?: string
          payload?: Json
          restaurant_id?: string
          result?: Json | null
          status?: string
        }
        Relationships: []
      }
      pos_order_discounts: {
        Row: {
          amount: number
          applied_by: string | null
          applied_by_name: string | null
          created_at: string
          id: string
          order_id: string
          reason: string
          restaurant_id: string
        }
        Insert: {
          amount: number
          applied_by?: string | null
          applied_by_name?: string | null
          created_at?: string
          id?: string
          order_id: string
          reason: string
          restaurant_id: string
        }
        Update: {
          amount?: number
          applied_by?: string | null
          applied_by_name?: string | null
          created_at?: string
          id?: string
          order_id?: string
          reason?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_order_discounts_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_order_discounts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_order_discounts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_order_items: {
        Row: {
          category: string | null
          client_item_id: string | null
          created_at: string
          id: string
          is_voided: boolean
          menu_item_id: string
          modifiers: Json
          name: string
          notes: string | null
          offline_device_id: string | null
          order_id: string
          parent_item_id: string | null
          quantity: number
          seat_label: string | null
          seat_number: number | null
          sent_to_kitchen_at: string | null
          sent_to_kitchen_by: string | null
          total_price: number
          unit_price: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          voided_by_name: string | null
        }
        Insert: {
          category?: string | null
          client_item_id?: string | null
          created_at?: string
          id?: string
          is_voided?: boolean
          menu_item_id: string
          modifiers?: Json
          name: string
          notes?: string | null
          offline_device_id?: string | null
          order_id: string
          parent_item_id?: string | null
          quantity: number
          seat_label?: string | null
          seat_number?: number | null
          sent_to_kitchen_at?: string | null
          sent_to_kitchen_by?: string | null
          total_price: number
          unit_price: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          voided_by_name?: string | null
        }
        Update: {
          category?: string | null
          client_item_id?: string | null
          created_at?: string
          id?: string
          is_voided?: boolean
          menu_item_id?: string
          modifiers?: Json
          name?: string
          notes?: string | null
          offline_device_id?: string | null
          order_id?: string
          parent_item_id?: string | null
          quantity?: number
          seat_label?: string | null
          seat_number?: number | null
          sent_to_kitchen_at?: string | null
          sent_to_kitchen_by?: string | null
          total_price?: number
          unit_price?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          voided_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_order_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "pos_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_order_items_sent_to_kitchen_by_fkey"
            columns: ["sent_to_kitchen_by"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_order_items_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_orders: {
        Row: {
          bill_printed_at: string | null
          client_order_id: string | null
          closed_at: string | null
          created_at: string
          discount_amount: number
          discount_applied_by: string | null
          discount_applied_by_name: string | null
          discount_reason: string | null
          gratuity_amount: number
          gratuity_rate: number
          host_handoff_id: string | null
          host_visit_id: string | null
          id: string
          kitchen_notes: string | null
          kitchen_ticket_printed_at: string | null
          offline_conflict_reason: string | null
          offline_device_id: string | null
          offline_sync_status: string | null
          order_number: string
          party_size: number | null
          payment_status: string
          receipt_note: string | null
          receipt_note_author_id: string | null
          receipt_note_author_name: string | null
          receipt_note_updated_at: string | null
          restaurant_id: string
          sent_to_kitchen_at: string | null
          status: string
          subtotal: number
          table_id: string
          table_number: string
          tax_amount: number
          tax_rate: number
          tip_amount: number
          total: number
          updated_at: string
          waiter_id: string
          waiter_name: string
        }
        Insert: {
          bill_printed_at?: string | null
          client_order_id?: string | null
          closed_at?: string | null
          created_at?: string
          discount_amount?: number
          discount_applied_by?: string | null
          discount_applied_by_name?: string | null
          discount_reason?: string | null
          gratuity_amount?: number
          gratuity_rate?: number
          host_handoff_id?: string | null
          host_visit_id?: string | null
          id?: string
          kitchen_notes?: string | null
          kitchen_ticket_printed_at?: string | null
          offline_conflict_reason?: string | null
          offline_device_id?: string | null
          offline_sync_status?: string | null
          order_number: string
          party_size?: number | null
          payment_status?: string
          receipt_note?: string | null
          receipt_note_author_id?: string | null
          receipt_note_author_name?: string | null
          receipt_note_updated_at?: string | null
          restaurant_id: string
          sent_to_kitchen_at?: string | null
          status?: string
          subtotal?: number
          table_id: string
          table_number: string
          tax_amount?: number
          tax_rate: number
          tip_amount?: number
          total?: number
          updated_at?: string
          waiter_id: string
          waiter_name: string
        }
        Update: {
          bill_printed_at?: string | null
          client_order_id?: string | null
          closed_at?: string | null
          created_at?: string
          discount_amount?: number
          discount_applied_by?: string | null
          discount_applied_by_name?: string | null
          discount_reason?: string | null
          gratuity_amount?: number
          gratuity_rate?: number
          host_handoff_id?: string | null
          host_visit_id?: string | null
          id?: string
          kitchen_notes?: string | null
          kitchen_ticket_printed_at?: string | null
          offline_conflict_reason?: string | null
          offline_device_id?: string | null
          offline_sync_status?: string | null
          order_number?: string
          party_size?: number | null
          payment_status?: string
          receipt_note?: string | null
          receipt_note_author_id?: string | null
          receipt_note_author_name?: string | null
          receipt_note_updated_at?: string | null
          restaurant_id?: string
          sent_to_kitchen_at?: string | null
          status?: string
          subtotal?: number
          table_id?: string
          table_number?: string
          tax_amount?: number
          tax_rate?: number
          tip_amount?: number
          total?: number
          updated_at?: string
          waiter_id?: string
          waiter_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_orders_discount_applied_by_fkey"
            columns: ["discount_applied_by"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_receipt_note_author_id_fkey"
            columns: ["receipt_note_author_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_payments: {
        Row: {
          amount: number
          authorized_amount: number | null
          captured_at: string | null
          card_brand: string | null
          card_funding: string | null
          card_last4: string | null
          client_payment_id: string | null
          completed_at: string | null
          created_at: string
          deposit_batch_id: string | null
          deposit_expected_at: string | null
          deposit_status: string
          deposited_at: string | null
          net_deposit_amount: number | null
          processor_fee_amount: number | null
          processor_fee_currency: string
          processor_fee_recorded_at: string | null
          processor_fee_source: string | null
          failure_code: string | null
          failure_reason: string | null
          helcim_approval_code: string | null
          helcim_card_token: string | null
          helcim_checkout_token: string | null
          helcim_preauth_transaction_id: string | null
          helcim_transaction_id: string | null
          id: string
          offline_device_id: string | null
          order_id: string
          payment_method: string
          refunded_at: string | null
          restaurant_id: string
          standalone_reference: string | null
          status: string
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          stripe_receipt_url: string | null
          tip_amount: number
          total_charged: number
        }
        Insert: {
          amount: number
          authorized_amount?: number | null
          captured_at?: string | null
          card_brand?: string | null
          card_funding?: string | null
          card_last4?: string | null
          client_payment_id?: string | null
          completed_at?: string | null
          created_at?: string
          deposit_batch_id?: string | null
          deposit_expected_at?: string | null
          deposit_status?: string
          deposited_at?: string | null
          net_deposit_amount?: number | null
          processor_fee_amount?: number | null
          processor_fee_currency?: string
          processor_fee_recorded_at?: string | null
          processor_fee_source?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          helcim_approval_code?: string | null
          helcim_card_token?: string | null
          helcim_checkout_token?: string | null
          helcim_preauth_transaction_id?: string | null
          helcim_transaction_id?: string | null
          id?: string
          offline_device_id?: string | null
          order_id: string
          payment_method: string
          refunded_at?: string | null
          restaurant_id: string
          standalone_reference?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_receipt_url?: string | null
          tip_amount?: number
          total_charged: number
        }
        Update: {
          amount?: number
          authorized_amount?: number | null
          captured_at?: string | null
          card_brand?: string | null
          card_funding?: string | null
          card_last4?: string | null
          client_payment_id?: string | null
          completed_at?: string | null
          created_at?: string
          deposit_batch_id?: string | null
          deposit_expected_at?: string | null
          deposit_status?: string
          deposited_at?: string | null
          net_deposit_amount?: number | null
          processor_fee_amount?: number | null
          processor_fee_currency?: string
          processor_fee_recorded_at?: string | null
          processor_fee_source?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          helcim_approval_code?: string | null
          helcim_card_token?: string | null
          helcim_checkout_token?: string | null
          helcim_preauth_transaction_id?: string | null
          helcim_transaction_id?: string | null
          id?: string
          offline_device_id?: string | null
          order_id?: string
          payment_method?: string
          refunded_at?: string | null
          restaurant_id?: string
          standalone_reference?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_receipt_url?: string | null
          tip_amount?: number
          total_charged?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_print_jobs: {
        Row: {
          attempts: number
          client_order_id: string | null
          client_print_id: string
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          order_id: string | null
          printed_at: string | null
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          client_order_id?: string | null
          client_print_id: string
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          order_id?: string | null
          printed_at?: string | null
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          client_order_id?: string | null
          client_print_id?: string
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          order_id?: string | null
          printed_at?: string | null
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pos_restaurant_configs: {
        Row: {
          auto_gratuity_enabled: boolean
          auto_gratuity_party_threshold: number
          auto_gratuity_rate: number
          backend_webhook_url: string
          created_at: string
          helcim_api_token: string | null
          helcim_device_code: string | null
          helcim_webhook_verifier_token: string | null
          id: string
          kitchen_printer_ip: string | null
          payment_mode: string | null
          payment_provider: string | null
          pos_password: string
          printer_profile: string
          receipt_footer_message: string | null
          receipt_note_max_chars: number
          receipt_notes_enabled: boolean
          receipt_printer_ip: string | null
          stripe_account_id: string | null
          stripe_reader_id: string | null
          tax_rate: number
          tip_out_config: Json
        }
        Insert: {
          auto_gratuity_enabled?: boolean
          auto_gratuity_party_threshold?: number
          auto_gratuity_rate?: number
          backend_webhook_url: string
          created_at?: string
          helcim_api_token?: string | null
          helcim_device_code?: string | null
          helcim_webhook_verifier_token?: string | null
          id: string
          kitchen_printer_ip?: string | null
          payment_mode?: string | null
          payment_provider?: string | null
          pos_password?: string
          printer_profile?: string
          receipt_footer_message?: string | null
          receipt_note_max_chars?: number
          receipt_notes_enabled?: boolean
          receipt_printer_ip?: string | null
          stripe_account_id?: string | null
          stripe_reader_id?: string | null
          tax_rate?: number
          tip_out_config?: Json
        }
        Update: {
          auto_gratuity_enabled?: boolean
          auto_gratuity_party_threshold?: number
          auto_gratuity_rate?: number
          backend_webhook_url?: string
          created_at?: string
          helcim_api_token?: string | null
          helcim_device_code?: string | null
          helcim_webhook_verifier_token?: string | null
          id?: string
          kitchen_printer_ip?: string | null
          payment_mode?: string | null
          payment_provider?: string | null
          pos_password?: string
          printer_profile?: string
          receipt_footer_message?: string | null
          receipt_note_max_chars?: number
          receipt_notes_enabled?: boolean
          receipt_printer_ip?: string | null
          stripe_account_id?: string | null
          stripe_reader_id?: string | null
          tax_rate?: number
          tip_out_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pos_restaurant_configs_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_split_check_items: {
        Row: {
          allocation_type: string
          created_at: string
          id: string
          menu_item_id: string | null
          name: string
          order_item_id: string | null
          quantity: number
          split_check_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          allocation_type?: string
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name: string
          order_item_id?: string | null
          quantity?: number
          split_check_id: string
          total_price?: number
          unit_price?: number
        }
        Update: {
          allocation_type?: string
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name?: string
          order_item_id?: string | null
          quantity?: number
          split_check_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_split_check_items_split_check_id_fkey"
            columns: ["split_check_id"]
            isOneToOne: false
            referencedRelation: "pos_split_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_split_checks: {
        Row: {
          balance_due: number
          created_at: string
          discount_total: number
          id: string
          label: string
          order_id: string
          paid_total: number
          print_version: number
          restaurant_id: string
          stale_after_print: boolean
          status: string
          subtotal: number
          tax_amount: number
          taxable_subtotal: number
          tip_amount: number
          total_due: number
          updated_at: string
        }
        Insert: {
          balance_due?: number
          created_at?: string
          discount_total?: number
          id?: string
          label: string
          order_id: string
          paid_total?: number
          print_version?: number
          restaurant_id: string
          stale_after_print?: boolean
          status?: string
          subtotal?: number
          tax_amount?: number
          taxable_subtotal?: number
          tip_amount?: number
          total_due?: number
          updated_at?: string
        }
        Update: {
          balance_due?: number
          created_at?: string
          discount_total?: number
          id?: string
          label?: string
          order_id?: string
          paid_total?: number
          print_version?: number
          restaurant_id?: string
          stale_after_print?: boolean
          status?: string
          subtotal?: number
          tax_amount?: number
          taxable_subtotal?: number
          tip_amount?: number
          total_due?: number
          updated_at?: string
        }
        Relationships: []
      }
      pos_split_discounts: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by_manager_id: string | null
          approved_by_manager_name: string | null
          created_at: string
          discount_definition_id: string | null
          discount_type: string
          id: string
          label: string
          order_id: string
          reason: string | null
          requires_manager: boolean
          restaurant_id: string
          split_check_id: string | null
          value: number
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by_manager_id?: string | null
          approved_by_manager_name?: string | null
          created_at?: string
          discount_definition_id?: string | null
          discount_type: string
          id?: string
          label: string
          order_id: string
          reason?: string | null
          requires_manager?: boolean
          restaurant_id: string
          split_check_id?: string | null
          value?: number
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by_manager_id?: string | null
          approved_by_manager_name?: string | null
          created_at?: string
          discount_definition_id?: string | null
          discount_type?: string
          id?: string
          label?: string
          order_id?: string
          reason?: string | null
          requires_manager?: boolean
          restaurant_id?: string
          split_check_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_split_discounts_split_check_id_fkey"
            columns: ["split_check_id"]
            isOneToOne: false
            referencedRelation: "pos_split_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_split_tenders: {
        Row: {
          amount: number
          change_due: number | null
          client_tender_id: string | null
          completed_at: string | null
          created_at: string
          deposit_batch_id: string | null
          deposit_expected_at: string | null
          deposit_status: string
          deposited_at: string | null
          net_deposit_amount: number | null
          processor_fee_amount: number | null
          processor_fee_currency: string
          processor_fee_recorded_at: string | null
          processor_fee_source: string | null
          failure_reason: string | null
          gift_card_id: string | null
          id: string
          order_id: string
          payment_method: string
          reference: string | null
          restaurant_id: string
          split_check_id: string | null
          status: string
          tendered_amount: number | null
          tip_amount: number
          total_charged: number
        }
        Insert: {
          amount?: number
          change_due?: number | null
          client_tender_id?: string | null
          completed_at?: string | null
          created_at?: string
          deposit_batch_id?: string | null
          deposit_expected_at?: string | null
          deposit_status?: string
          deposited_at?: string | null
          net_deposit_amount?: number | null
          processor_fee_amount?: number | null
          processor_fee_currency?: string
          processor_fee_recorded_at?: string | null
          processor_fee_source?: string | null
          failure_reason?: string | null
          gift_card_id?: string | null
          id?: string
          order_id: string
          payment_method: string
          reference?: string | null
          restaurant_id: string
          split_check_id?: string | null
          status?: string
          tendered_amount?: number | null
          tip_amount?: number
          total_charged?: number
        }
        Update: {
          amount?: number
          change_due?: number | null
          client_tender_id?: string | null
          completed_at?: string | null
          created_at?: string
          deposit_batch_id?: string | null
          deposit_expected_at?: string | null
          deposit_status?: string
          deposited_at?: string | null
          net_deposit_amount?: number | null
          processor_fee_amount?: number | null
          processor_fee_currency?: string
          processor_fee_recorded_at?: string | null
          processor_fee_source?: string | null
          failure_reason?: string | null
          gift_card_id?: string | null
          id?: string
          order_id?: string
          payment_method?: string
          reference?: string | null
          restaurant_id?: string
          split_check_id?: string | null
          status?: string
          tendered_amount?: number | null
          tip_amount?: number
          total_charged?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_split_tenders_split_check_id_fkey"
            columns: ["split_check_id"]
            isOneToOne: false
            referencedRelation: "pos_split_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_table_service_states: {
        Row: {
          assigned_waiter_external_id: string | null
          assigned_waiter_id: string | null
          assigned_waiter_name: string | null
          last_server_visit_at: string | null
          last_service_context: Json
          order_id: string | null
          party_size: number | null
          restaurant_id: string
          service_phase: string | null
          service_state: string
          state_entered_at: string
          table_id: string
          updated_at: string
        }
        Insert: {
          assigned_waiter_external_id?: string | null
          assigned_waiter_id?: string | null
          assigned_waiter_name?: string | null
          last_server_visit_at?: string | null
          last_service_context?: Json
          order_id?: string | null
          party_size?: number | null
          restaurant_id: string
          service_phase?: string | null
          service_state?: string
          state_entered_at?: string
          table_id: string
          updated_at?: string
        }
        Update: {
          assigned_waiter_external_id?: string | null
          assigned_waiter_id?: string | null
          assigned_waiter_name?: string | null
          last_server_visit_at?: string | null
          last_service_context?: Json
          order_id?: string | null
          party_size?: number | null
          restaurant_id?: string
          service_phase?: string | null
          service_state?: string
          state_entered_at?: string
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_table_service_states_assigned_waiter_id_fkey"
            columns: ["assigned_waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_table_service_states_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_table_service_states_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_time_clock_adjustments: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entry_id: string | null
          id: string
          manager_id: string
          manager_name: string
          reason: string
          restaurant_id: string
          staff_id: string
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entry_id?: string | null
          id?: string
          manager_id: string
          manager_name: string
          reason: string
          restaurant_id: string
          staff_id: string
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entry_id?: string | null
          id?: string
          manager_id?: string
          manager_name?: string
          reason?: string
          restaurant_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_time_clock_adjustments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "pos_time_clock_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_time_clock_adjustments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_time_clock_adjustments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_time_clock_entries: {
        Row: {
          clock_in_at: string
          clock_in_device_id: string | null
          clock_in_event_id: string | null
          clock_out_at: string | null
          clock_out_device_id: string | null
          clock_out_event_id: string | null
          created_at: string
          edit_reason: string | null
          edited_at: string | null
          edited_by_manager_id: string | null
          edited_by_manager_name: string | null
          id: string
          is_voided: boolean
          restaurant_id: string
          role: string
          staff_id: string
          staff_name: string
          status: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by_manager_id: string | null
          voided_by_manager_name: string | null
        }
        Insert: {
          clock_in_at: string
          clock_in_device_id?: string | null
          clock_in_event_id?: string | null
          clock_out_at?: string | null
          clock_out_device_id?: string | null
          clock_out_event_id?: string | null
          created_at?: string
          edit_reason?: string | null
          edited_at?: string | null
          edited_by_manager_id?: string | null
          edited_by_manager_name?: string | null
          id?: string
          is_voided?: boolean
          restaurant_id: string
          role?: string
          staff_id: string
          staff_name: string
          status?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_manager_id?: string | null
          voided_by_manager_name?: string | null
        }
        Update: {
          clock_in_at?: string
          clock_in_device_id?: string | null
          clock_in_event_id?: string | null
          clock_out_at?: string | null
          clock_out_device_id?: string | null
          clock_out_event_id?: string | null
          created_at?: string
          edit_reason?: string | null
          edited_at?: string | null
          edited_by_manager_id?: string | null
          edited_by_manager_name?: string | null
          id?: string
          is_voided?: boolean
          restaurant_id?: string
          role?: string
          staff_id?: string
          staff_name?: string
          status?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_manager_id?: string | null
          voided_by_manager_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_time_clock_entries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_time_clock_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_time_clock_events: {
        Row: {
          client_event_id: string
          created_at: string
          device_id: string | null
          entry_id: string | null
          event_type: string
          id: string
          occurred_at: string
          restaurant_id: string
          result: Json | null
          staff_id: string
        }
        Insert: {
          client_event_id: string
          created_at?: string
          device_id?: string | null
          entry_id?: string | null
          event_type: string
          id?: string
          occurred_at: string
          restaurant_id: string
          result?: Json | null
          staff_id: string
        }
        Update: {
          client_event_id?: string
          created_at?: string
          device_id?: string | null
          entry_id?: string | null
          event_type?: string
          id?: string
          occurred_at?: string
          restaurant_id?: string
          result?: Json | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_time_clock_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "pos_time_clock_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_time_clock_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_time_clock_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_tip_adjustments: {
        Row: {
          changed_by_name: string | null
          changed_by_staff_id: string | null
          created_at: string
          id: string
          new_tip: number
          old_tip: number
          order_id: string
          payment_id: string | null
          reason: string | null
          restaurant_id: string
          role: string | null
        }
        Insert: {
          changed_by_name?: string | null
          changed_by_staff_id?: string | null
          created_at?: string
          id?: string
          new_tip?: number
          old_tip?: number
          order_id: string
          payment_id?: string | null
          reason?: string | null
          restaurant_id: string
          role?: string | null
        }
        Update: {
          changed_by_name?: string | null
          changed_by_staff_id?: string | null
          created_at?: string
          id?: string
          new_tip?: number
          old_tip?: number
          order_id?: string
          payment_id?: string | null
          reason?: string | null
          restaurant_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_tip_adjustments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_tip_declarations: {
        Row: {
          amount: number
          business_date: string
          created_at: string
          created_by_staff_id: string | null
          id: string
          restaurant_id: string
          staff_id: string | null
          staff_name: string | null
          type: string
        }
        Insert: {
          amount?: number
          business_date: string
          created_at?: string
          created_by_staff_id?: string | null
          id?: string
          restaurant_id: string
          staff_id?: string | null
          staff_name?: string | null
          type?: string
        }
        Update: {
          amount?: number
          business_date?: string
          created_at?: string
          created_by_staff_id?: string | null
          id?: string
          restaurant_id?: string
          staff_id?: string | null
          staff_name?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_tip_declarations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          event_type: string
          id: string
          last_error: string | null
          next_retry_at: string | null
          payload: Json
          restaurant_id: string
          status: string
          target_url: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          next_retry_at?: string | null
          payload: Json
          restaurant_id: string
          status?: string
          target_url: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          next_retry_at?: string | null
          payload?: Json
          restaurant_id?: string
          status?: string
          target_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_webhook_deliveries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string | null
          avatar_url: string | null
          created_at: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          account_type?: string | null
          avatar_url?: string | null
          created_at?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          account_type?: string | null
          avatar_url?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      recipes: {
        Row: {
          id: string
          ingredient_id: string
          menu_item_id: string
          notes: string | null
          quantity: number
          unit: string
        }
        Insert: {
          id?: string
          ingredient_id: string
          menu_item_id: string
          notes?: string | null
          quantity: number
          unit: string
        }
        Update: {
          id?: string
          ingredient_id?: string
          menu_item_id?: string
          notes?: string | null
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_blackouts: {
        Row: {
          active: boolean
          archive_reason: string | null
          archived_at: string | null
          archived_by_user_id: string | null
          channels: Json
          created_at: string
          created_by_user_id: string | null
          end_date: string
          end_time: string | null
          id: string
          reason: string | null
          restaurant_id: string
          service_period_id: string | null
          start_date: string
          start_time: string | null
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          active?: boolean
          archive_reason?: string | null
          archived_at?: string | null
          archived_by_user_id?: string | null
          channels?: Json
          created_at?: string
          created_by_user_id?: string | null
          end_date: string
          end_time?: string | null
          id?: string
          reason?: string | null
          restaurant_id: string
          service_period_id?: string | null
          start_date: string
          start_time?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          active?: boolean
          archive_reason?: string | null
          archived_at?: string | null
          archived_by_user_id?: string | null
          channels?: Json
          created_at?: string
          created_by_user_id?: string | null
          end_date?: string
          end_time?: string | null
          id?: string
          reason?: string | null
          restaurant_id?: string
          service_period_id?: string | null
          start_date?: string
          start_time?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_blackouts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_blackouts_service_period_id_fkey"
            columns: ["service_period_id"]
            isOneToOne: false
            referencedRelation: "reservation_service_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_channel_connections: {
        Row: {
          capabilities: Json
          connection_status: string
          created_at: string
          id: string
          last_published_at: string | null
          last_synced_at: string | null
          metadata: Json
          provider: string
          provider_location_id: string | null
          redirect_booking_url: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          capabilities?: Json
          connection_status?: string
          created_at?: string
          id?: string
          last_published_at?: string | null
          last_synced_at?: string | null
          metadata?: Json
          provider: string
          provider_location_id?: string | null
          redirect_booking_url?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          capabilities?: Json
          connection_status?: string
          created_at?: string
          id?: string
          last_published_at?: string | null
          last_synced_at?: string | null
          metadata?: Json
          provider?: string
          provider_location_id?: string | null
          redirect_booking_url?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_channel_connections_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_channel_rules: {
        Row: {
          channel: string
          created_at: string
          id: string
          is_enabled: boolean
          restaurant_id: string
          service_period_id: string | null
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          restaurant_id: string
          service_period_id?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          restaurant_id?: string
          service_period_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_channel_rules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_channel_rules_service_period_id_fkey"
            columns: ["service_period_id"]
            isOneToOne: false
            referencedRelation: "reservation_service_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          reservation_id: string
          restaurant_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          reservation_id: string
          restaurant_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          reservation_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_events_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_holds: {
        Row: {
          channel: string
          created_at: string
          expires_at: string
          id: string
          party_size: number
          reservation_time: string
          restaurant_id: string
          service_date: string
          service_period_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          expires_at: string
          id?: string
          party_size: number
          reservation_time: string
          restaurant_id: string
          service_date: string
          service_period_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          expires_at?: string
          id?: string
          party_size?: number
          reservation_time?: string
          restaurant_id?: string
          service_date?: string
          service_period_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_holds_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_holds_service_period_id_fkey"
            columns: ["service_period_id"]
            isOneToOne: false
            referencedRelation: "reservation_service_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_manage_tokens: {
        Row: {
          allowed_actions: Json
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          last_used_at: string | null
          one_time: boolean
          reservation_id: string
          restaurant_id: string
          token_hash: string
        }
        Insert: {
          allowed_actions?: Json
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          last_used_at?: string | null
          one_time?: boolean
          reservation_id: string
          restaurant_id: string
          token_hash: string
        }
        Update: {
          allowed_actions?: Json
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          one_time?: boolean
          reservation_id?: string
          restaurant_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_manage_tokens_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_manage_tokens_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_pacing_rules: {
        Row: {
          active: boolean
          channel: string | null
          created_at: string
          id: string
          max_covers: number
          restaurant_id: string
          service_period_id: string | null
          updated_at: string
          window_minutes: number
        }
        Insert: {
          active?: boolean
          channel?: string | null
          created_at?: string
          id?: string
          max_covers: number
          restaurant_id: string
          service_period_id?: string | null
          updated_at?: string
          window_minutes?: number
        }
        Update: {
          active?: boolean
          channel?: string | null
          created_at?: string
          id?: string
          max_covers?: number
          restaurant_id?: string
          service_period_id?: string | null
          updated_at?: string
          window_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "reservation_pacing_rules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_pacing_rules_service_period_id_fkey"
            columns: ["service_period_id"]
            isOneToOne: false
            referencedRelation: "reservation_service_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_service_periods: {
        Row: {
          active: boolean
          created_at: string
          day_of_week: number
          default_duration_minutes: number
          end_time: string
          id: string
          lead_time_minutes: number
          max_party_size: number
          min_party_size: number
          name: string
          restaurant_id: string
          same_day_cutoff_time: string | null
          slot_interval_minutes: number
          start_time: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          day_of_week: number
          default_duration_minutes?: number
          end_time: string
          id?: string
          lead_time_minutes?: number
          max_party_size?: number
          min_party_size?: number
          name: string
          restaurant_id: string
          same_day_cutoff_time?: string | null
          slot_interval_minutes?: number
          start_time: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          day_of_week?: number
          default_duration_minutes?: number
          end_time?: string
          id?: string
          lead_time_minutes?: number
          max_party_size?: number
          min_party_size?: number
          name?: string
          restaurant_id?: string
          same_day_cutoff_time?: string | null
          slot_interval_minutes?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_service_periods_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_settings: {
        Row: {
          booking_horizon_days: number
          created_at: string
          default_slot_interval_minutes: number
          grace_period_minutes: number
          reminder_enabled: boolean
          reminder_hours_before: number
          restaurant_id: string
          same_day_reminder_enabled: boolean
          same_day_reminder_hours_before: number
          updated_at: string
          waitlist_end_of_day_close_enabled: boolean
          waitlist_stale_minutes: number
        }
        Insert: {
          booking_horizon_days?: number
          created_at?: string
          default_slot_interval_minutes?: number
          grace_period_minutes?: number
          reminder_enabled?: boolean
          reminder_hours_before?: number
          restaurant_id: string
          same_day_reminder_enabled?: boolean
          same_day_reminder_hours_before?: number
          updated_at?: string
          waitlist_end_of_day_close_enabled?: boolean
          waitlist_stale_minutes?: number
        }
        Update: {
          booking_horizon_days?: number
          created_at?: string
          default_slot_interval_minutes?: number
          grace_period_minutes?: number
          reminder_enabled?: boolean
          reminder_hours_before?: number
          restaurant_id?: string
          same_day_reminder_enabled?: boolean
          same_day_reminder_hours_before?: number
          updated_at?: string
          waitlist_end_of_day_close_enabled?: boolean
          waitlist_stale_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "reservation_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by_user_id: string | null
          assigned_table_id: string | null
          booked_at: string
          canceled_at: string | null
          channel: string
          checked_in_at: string | null
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          duplicate_remove_reason: string | null
          duplicate_removed_at: string | null
          duplicate_removed_by_user_id: string | null
          external_location_id: string | null
          external_payload: Json
          external_provider: string | null
          external_reservation_id: string | null
          external_sync_state: string
          guest_id: string
          id: string
          last_transition_source: string | null
          late_arrival_hold_reason: string | null
          late_arrival_hold_set_at: string | null
          late_arrival_hold_set_by_user_id: string | null
          late_arrival_hold_until: string | null
          no_show_at: string | null
          notes_internal: string | null
          organization_id: string
          override_pacing: boolean
          override_reason: string | null
          party_size: number
          quoted_duration_minutes: number | null
          reservation_time: string
          restaurant_id: string
          seated_at: string | null
          seating_preference: string | null
          service_date: string
          service_period_id: string | null
          source: string
          special_requests: string | null
          status: string
          status_reason: string | null
          updated_at: string
          version: number
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by_user_id?: string | null
          assigned_table_id?: string | null
          booked_at?: string
          canceled_at?: string | null
          channel: string
          checked_in_at?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          duplicate_remove_reason?: string | null
          duplicate_removed_at?: string | null
          duplicate_removed_by_user_id?: string | null
          external_location_id?: string | null
          external_payload?: Json
          external_provider?: string | null
          external_reservation_id?: string | null
          external_sync_state?: string
          guest_id: string
          id?: string
          last_transition_source?: string | null
          late_arrival_hold_reason?: string | null
          late_arrival_hold_set_at?: string | null
          late_arrival_hold_set_by_user_id?: string | null
          late_arrival_hold_until?: string | null
          no_show_at?: string | null
          notes_internal?: string | null
          organization_id: string
          override_pacing?: boolean
          override_reason?: string | null
          party_size: number
          quoted_duration_minutes?: number | null
          reservation_time: string
          restaurant_id: string
          seated_at?: string | null
          seating_preference?: string | null
          service_date: string
          service_period_id?: string | null
          source: string
          special_requests?: string | null
          status?: string
          status_reason?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by_user_id?: string | null
          assigned_table_id?: string | null
          booked_at?: string
          canceled_at?: string | null
          channel?: string
          checked_in_at?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          duplicate_remove_reason?: string | null
          duplicate_removed_at?: string | null
          duplicate_removed_by_user_id?: string | null
          external_location_id?: string | null
          external_payload?: Json
          external_provider?: string | null
          external_reservation_id?: string | null
          external_sync_state?: string
          guest_id?: string
          id?: string
          last_transition_source?: string | null
          late_arrival_hold_reason?: string | null
          late_arrival_hold_set_at?: string | null
          late_arrival_hold_set_by_user_id?: string | null
          late_arrival_hold_until?: string | null
          no_show_at?: string | null
          notes_internal?: string | null
          organization_id?: string
          override_pacing?: boolean
          override_reason?: string | null
          party_size?: number
          quoted_duration_minutes?: number | null
          reservation_time?: string
          restaurant_id?: string
          seated_at?: string | null
          seating_preference?: string | null
          service_date?: string
          service_period_id?: string | null
          source?: string
          special_requests?: string | null
          status?: string
          status_reason?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reservations_assigned_table_id_fkey"
            columns: ["assigned_table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_service_period_id_fkey"
            columns: ["service_period_id"]
            isOneToOne: false
            referencedRelation: "reservation_service_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      restaraunt_assignments: {
        Row: {
          approved: boolean | null
          id: number
          restaraunt: string | null
          user: string
        }
        Insert: {
          approved?: boolean | null
          id?: number
          restaraunt?: string | null
          user: string
        }
        Update: {
          approved?: boolean | null
          id?: number
          restaraunt?: string | null
          user?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaraunt_assignments_restaraunt_fkey"
            columns: ["restaraunt"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaraunt_assignments_user_fkey"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["user"]
          },
        ]
      }
      restaurant_integrations: {
        Row: {
          access_token_encrypted: string | null
          config: Json | null
          created_at: string | null
          external_id: string | null
          id: string
          last_error: string | null
          last_sync_at: string | null
          provider_id: string
          refresh_token_encrypted: string | null
          restaurant_id: string
          status: string | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          config?: Json | null
          created_at?: string | null
          external_id?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          provider_id: string
          refresh_token_encrypted?: string | null
          restaurant_id: string
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          config?: Json | null
          created_at?: string | null
          external_id?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          provider_id?: string
          refresh_token_encrypted?: string | null
          restaurant_id?: string
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_integrations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "integration_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_integrations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_members: {
        Row: {
          accepted_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          permissions: string[] | null
          restaurant_id: string
          role: string
          status: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          permissions?: string[] | null
          restaurant_id: string
          role?: string
          status?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          permissions?: string[] | null
          restaurant_id?: string
          role?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_onboarding_state: {
        Row: {
          approved_tables_json: Json
          created_at: string
          floor_map_json: Json | null
          onboarding_sessions_json: Json
          pair_requests_json: Json
          restaurant_id: string
          runtime_override_json: Json | null
          site_id_alias: string
          template_json: Json
          updated_at: string
        }
        Insert: {
          approved_tables_json?: Json
          created_at?: string
          floor_map_json?: Json | null
          onboarding_sessions_json?: Json
          pair_requests_json?: Json
          restaurant_id: string
          runtime_override_json?: Json | null
          site_id_alias: string
          template_json?: Json
          updated_at?: string
        }
        Update: {
          approved_tables_json?: Json
          created_at?: string
          floor_map_json?: Json | null
          onboarding_sessions_json?: Json
          pair_requests_json?: Json
          restaurant_id?: string
          runtime_override_json?: Json | null
          site_id_alias?: string
          template_json?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_onboarding_state_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_slug_redirects: {
        Row: {
          created_at: string
          old_slug: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          old_slug: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          old_slug?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_slug_redirects_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          city: string | null
          config: Json | null
          country: string | null
          cover_image_url: string | null
          created_at: string | null
          cuisine_types: string[] | null
          email: string | null
          floor_plan_data: Json | null
          floor_plan_image_url: string | null
          floor_plan_updated_at: string | null
          id: string
          join_code: string
          logo_url: string | null
          name: string
          onboarding_completed_at: string | null
          onboarding_step: number
          organization_id: string | null
          owner_id: string | null
          phone: string | null
          postal_code: string | null
          public_slug: string
          seating_capacity: number | null
          slug: string | null
          state: string | null
          status: string
          table_count: number | null
          timezone: string | null
          type: string | null
          updated_at: string | null
          website: string | null
          yelp_url: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          config?: Json | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          cuisine_types?: string[] | null
          email?: string | null
          floor_plan_data?: Json | null
          floor_plan_image_url?: string | null
          floor_plan_updated_at?: string | null
          id?: string
          join_code?: string
          logo_url?: string | null
          name: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          organization_id?: string | null
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          public_slug: string
          seating_capacity?: number | null
          slug?: string | null
          state?: string | null
          status?: string
          table_count?: number | null
          timezone?: string | null
          type?: string | null
          updated_at?: string | null
          website?: string | null
          yelp_url?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          config?: Json | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          cuisine_types?: string[] | null
          email?: string | null
          floor_plan_data?: Json | null
          floor_plan_image_url?: string | null
          floor_plan_updated_at?: string | null
          id?: string
          join_code?: string
          logo_url?: string | null
          name?: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          organization_id?: string | null
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          public_slug?: string
          seating_capacity?: number | null
          slug?: string | null
          state?: string | null
          status?: string
          table_count?: number | null
          timezone?: string | null
          type?: string | null
          updated_at?: string | null
          website?: string | null
          yelp_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          category_opinions: Json | null
          created_at: string | null
          id: string
          needs_attention: boolean | null
          overall_summary: string | null
          platform: string | null
          rating: number | null
          restaurant_id: string | null
          review_date: string | null
          review_identifier: string | null
          sentiment_score: number | null
          status: string | null
          text: string | null
          updated_at: string | null
        }
        Insert: {
          category_opinions?: Json | null
          created_at?: string | null
          id?: string
          needs_attention?: boolean | null
          overall_summary?: string | null
          platform?: string | null
          rating?: number | null
          restaurant_id?: string | null
          review_date?: string | null
          review_identifier?: string | null
          sentiment_score?: number | null
          status?: string | null
          text?: string | null
          updated_at?: string | null
        }
        Update: {
          category_opinions?: Json | null
          created_at?: string | null
          id?: string
          needs_attention?: boolean | null
          overall_summary?: string | null
          platform?: string | null
          rating?: number | null
          restaurant_id?: string | null
          review_date?: string | null
          review_identifier?: string | null
          sentiment_score?: number | null
          status?: string | null
          text?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          id: number
          restaraunt_id: string | null
          room_name: string | null
          table_scan_id: number | null
        }
        Insert: {
          id?: number
          restaraunt_id?: string | null
          room_name?: string | null
          table_scan_id?: number | null
        }
        Update: {
          id?: number
          restaraunt_id?: string | null
          room_name?: string | null
          table_scan_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_restaraunt_id_fkey"
            columns: ["restaraunt_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_table_scan_id_fkey"
            columns: ["table_scan_id"]
            isOneToOne: false
            referencedRelation: "table_scan"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_constraint_notes: {
        Row: {
          applied_request_id: string | null
          applies_from: string | null
          applies_until: string | null
          approved_at: string | null
          approved_by: string | null
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          is_hard_constraint: boolean
          parse_run_id: string | null
          parse_status: string
          parsed_by_model: string | null
          parsed_payload: Json
          priority: string | null
          raw_text: string
          restaurant_id: string
          status: string
          target_waiter_id: string | null
          updated_at: string
        }
        Insert: {
          applied_request_id?: string | null
          applies_from?: string | null
          applies_until?: string | null
          approved_at?: string | null
          approved_by?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_hard_constraint?: boolean
          parse_run_id?: string | null
          parse_status?: string
          parsed_by_model?: string | null
          parsed_payload?: Json
          priority?: string | null
          raw_text: string
          restaurant_id: string
          status?: string
          target_waiter_id?: string | null
          updated_at?: string
        }
        Update: {
          applied_request_id?: string | null
          applies_from?: string | null
          applies_until?: string | null
          approved_at?: string | null
          approved_by?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_hard_constraint?: boolean
          parse_run_id?: string | null
          parse_status?: string
          parsed_by_model?: string | null
          parsed_payload?: Json
          priority?: string | null
          raw_text?: string
          restaurant_id?: string
          status?: string
          target_waiter_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_constraint_notes_applied_request_fk"
            columns: ["applied_request_id"]
            isOneToOne: false
            referencedRelation: "employee_time_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_constraint_notes_parse_run_fk"
            columns: ["parse_run_id"]
            isOneToOne: false
            referencedRelation: "llm_parse_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_constraint_notes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_constraint_notes_target_waiter_fk"
            columns: ["target_waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_insights: {
        Row: {
          expires_at: string | null
          generated_at: string | null
          id: string
          insight_text: string
          insight_type: string
          metrics_snapshot: Json | null
          recommendations: Json | null
          restaurant_id: string
          schedule_id: string | null
        }
        Insert: {
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          insight_text: string
          insight_type: string
          metrics_snapshot?: Json | null
          recommendations?: Json | null
          restaurant_id: string
          schedule_id?: string | null
        }
        Update: {
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          insight_text?: string
          insight_type?: string
          metrics_snapshot?: Json | null
          recommendations?: Json | null
          restaurant_id?: string
          schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_insights_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_insights_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_items: {
        Row: {
          confidence_score: number | null
          constraint_flags: Json
          created_at: string
          fairness_impact_score: number | null
          id: string
          is_locked: boolean
          is_manual_override: boolean
          notes: string | null
          preference_match_score: number | null
          requirement_id: string | null
          role: string
          schedule_id: string
          schedule_run_id: string | null
          score_breakdown: Json
          section_id: string | null
          shift_date: string
          shift_end: string
          shift_label: string | null
          shift_start: string
          source: string
          status: string
          updated_at: string
          waiter_id: string
        }
        Insert: {
          confidence_score?: number | null
          constraint_flags?: Json
          created_at?: string
          fairness_impact_score?: number | null
          id?: string
          is_locked?: boolean
          is_manual_override?: boolean
          notes?: string | null
          preference_match_score?: number | null
          requirement_id?: string | null
          role?: string
          schedule_id: string
          schedule_run_id?: string | null
          score_breakdown?: Json
          section_id?: string | null
          shift_date: string
          shift_end: string
          shift_label?: string | null
          shift_start: string
          source?: string
          status?: string
          updated_at?: string
          waiter_id: string
        }
        Update: {
          confidence_score?: number | null
          constraint_flags?: Json
          created_at?: string
          fairness_impact_score?: number | null
          id?: string
          is_locked?: boolean
          is_manual_override?: boolean
          notes?: string | null
          preference_match_score?: number | null
          requirement_id?: string | null
          role?: string
          schedule_id?: string
          schedule_run_id?: string | null
          score_breakdown?: Json
          section_id?: string | null
          shift_date?: string
          shift_end?: string
          shift_label?: string | null
          shift_start?: string
          source?: string
          status?: string
          updated_at?: string
          waiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_items_requirement_fk"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "staffing_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_schedule_run_fk"
            columns: ["schedule_run_id"]
            isOneToOne: false
            referencedRelation: "schedule_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_trade_requests: {
        Row: {
          created_at: string
          id: string
          manager_approved_at: string | null
          manager_denied_at: string | null
          reason: string | null
          requesting_waiter_id: string
          requester_approved_at: string | null
          restaurant_id: string
          reviewed_by: string | null
          schedule_item_id: string
          status: string
          target_waiter_id: string
          target_approved_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_approved_at?: string | null
          manager_denied_at?: string | null
          reason?: string | null
          requesting_waiter_id: string
          requester_approved_at?: string | null
          restaurant_id: string
          reviewed_by?: string | null
          schedule_item_id: string
          status?: string
          target_waiter_id: string
          target_approved_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_approved_at?: string | null
          manager_denied_at?: string | null
          reason?: string | null
          requesting_waiter_id?: string
          requester_approved_at?: string | null
          restaurant_id?: string
          reviewed_by?: string | null
          schedule_item_id?: string
          status?: string
          target_waiter_id?: string
          target_approved_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_trade_requests_requesting_waiter_id_fkey"
            columns: ["requesting_waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_trade_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_trade_requests_schedule_item_id_fkey"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "schedule_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_trade_requests_target_waiter_id_fkey"
            columns: ["target_waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_reasoning: {
        Row: {
          confidence_score: number | null
          constraint_violations: string[]
          created_at: string
          hard_constraints: Json
          id: string
          reasons: string[]
          schedule_item_id: string
          schedule_run_id: string | null
          score_breakdown: Json
          soft_constraints: Json
        }
        Insert: {
          confidence_score?: number | null
          constraint_violations?: string[]
          created_at?: string
          hard_constraints?: Json
          id?: string
          reasons?: string[]
          schedule_item_id: string
          schedule_run_id?: string | null
          score_breakdown?: Json
          soft_constraints?: Json
        }
        Update: {
          confidence_score?: number | null
          constraint_violations?: string[]
          created_at?: string
          hard_constraints?: Json
          id?: string
          reasons?: string[]
          schedule_item_id?: string
          schedule_run_id?: string | null
          score_breakdown?: Json
          soft_constraints?: Json
        }
        Relationships: [
          {
            foreignKeyName: "schedule_reasoning_schedule_item_id_fkey"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "schedule_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_reasoning_schedule_run_id_fkey"
            columns: ["schedule_run_id"]
            isOneToOne: false
            referencedRelation: "schedule_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_runs: {
        Row: {
          completed_at: string | null
          coverage_gaps: Json
          created_at: string
          engine_version: string
          error_message: string | null
          id: string
          input_hash: string | null
          inputs_snapshot: Json | null
          restaurant_id: string
          run_status: string
          run_type: string
          schedule_id: string | null
          started_at: string | null
          summary_metrics: Json | null
          warnings: Json
          week_start_date: string
        }
        Insert: {
          completed_at?: string | null
          coverage_gaps?: Json
          created_at?: string
          engine_version?: string
          error_message?: string | null
          id?: string
          input_hash?: string | null
          inputs_snapshot?: Json | null
          restaurant_id: string
          run_status?: string
          run_type?: string
          schedule_id?: string | null
          started_at?: string | null
          summary_metrics?: Json | null
          warnings?: Json
          week_start_date: string
        }
        Update: {
          completed_at?: string | null
          coverage_gaps?: Json
          created_at?: string
          engine_version?: string
          error_message?: string | null
          id?: string
          input_hash?: string | null
          inputs_snapshot?: Json | null
          restaurant_id?: string
          run_status?: string
          run_type?: string
          schedule_id?: string | null
          started_at?: string | null
          summary_metrics?: Json | null
          warnings?: Json
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_runs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          coverage_score: number | null
          created_at: string | null
          fairness_score: number | null
          generated_by: string | null
          generation_params: Json | null
          id: string
          published_at: string | null
          restaurant_id: string
          schedule_run_id: string | null
          schedule_summary: string | null
          status: string | null
          total_hours: number | null
          total_shifts: number | null
          updated_at: string | null
          version: number
          week_end: string | null
          week_start: string | null
          week_start_date: string
        }
        Insert: {
          coverage_score?: number | null
          created_at?: string | null
          fairness_score?: number | null
          generated_by?: string | null
          generation_params?: Json | null
          id?: string
          published_at?: string | null
          restaurant_id: string
          schedule_run_id?: string | null
          schedule_summary?: string | null
          status?: string | null
          total_hours?: number | null
          total_shifts?: number | null
          updated_at?: string | null
          version?: number
          week_end?: string | null
          week_start?: string | null
          week_start_date: string
        }
        Update: {
          coverage_score?: number | null
          created_at?: string | null
          fairness_score?: number | null
          generated_by?: string | null
          generation_params?: Json | null
          id?: string
          published_at?: string | null
          restaurant_id?: string
          schedule_run_id?: string | null
          schedule_summary?: string | null
          status?: string | null
          total_hours?: number | null
          total_shifts?: number | null
          updated_at?: string | null
          version?: number
          week_end?: string | null
          week_start?: string | null
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_schedule_run_id_fkey"
            columns: ["schedule_run_id"]
            isOneToOne: false
            referencedRelation: "schedule_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          restaurant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string | null
          id: string
          restaurant_id: string
          section_id: string | null
          status: string | null
          tables_served: number | null
          total_covers: number | null
          total_sales: number | null
          total_tips: number | null
          updated_at: string | null
          waiter_id: string
        }
        Insert: {
          clock_in: string
          clock_out?: string | null
          created_at?: string | null
          id?: string
          restaurant_id: string
          section_id?: string | null
          status?: string | null
          tables_served?: number | null
          total_covers?: number | null
          total_sales?: number | null
          total_tips?: number | null
          updated_at?: string | null
          waiter_id: string
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string | null
          id?: string
          restaurant_id?: string
          section_id?: string | null
          status?: string | null
          tables_served?: number | null
          total_covers?: number | null
          total_sales?: number | null
          total_tips?: number | null
          updated_at?: string | null
          waiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by_user_id: string | null
          created_by_waiter_id: string | null
          id: string
          restaurant_id: string
          title: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by_user_id?: string | null
          created_by_waiter_id?: string | null
          id?: string
          restaurant_id: string
          title: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by_user_id?: string | null
          created_by_waiter_id?: string | null
          id?: string
          restaurant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_announcements_created_by_waiter_id_fkey"
            columns: ["created_by_waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_announcements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_availability: {
        Row: {
          availability_type: string
          created_at: string | null
          day_of_week: number | null
          effective_from: string | null
          effective_until: string | null
          end_time: string | null
          id: string
          notes: string | null
          preference: string | null
          restaurant_id: string
          start_time: string | null
          updated_at: string | null
          waiter_id: string
        }
        Insert: {
          availability_type: string
          created_at?: string | null
          day_of_week?: number | null
          effective_from?: string | null
          effective_until?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          preference?: string | null
          restaurant_id: string
          start_time?: string | null
          updated_at?: string | null
          waiter_id: string
        }
        Update: {
          availability_type?: string
          created_at?: string | null
          day_of_week?: number | null
          effective_from?: string | null
          effective_until?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          preference?: string | null
          restaurant_id?: string
          start_time?: string | null
          updated_at?: string | null
          waiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_availability_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_availability_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_conversation_members: {
        Row: {
          conversation_id: string
          created_at: string
          last_read_at: string | null
          waiter_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          last_read_at?: string | null
          waiter_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          last_read_at?: string | null
          waiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "staff_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_conversation_members_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_conversations: {
        Row: {
          conversation_type: string
          created_at: string
          created_by_user_id: string | null
          created_by_waiter_id: string | null
          id: string
          restaurant_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          conversation_type?: string
          created_at?: string
          created_by_user_id?: string | null
          created_by_waiter_id?: string | null
          id?: string
          restaurant_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          conversation_type?: string
          created_at?: string
          created_by_user_id?: string | null
          created_by_waiter_id?: string | null
          id?: string
          restaurant_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_conversations_created_by_waiter_id_fkey"
            columns: ["created_by_waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_conversations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          recorded_at: string | null
          restaurant_id: string
          shift_id: string | null
          table_id: string | null
          visit_id: string | null
          waiter_id: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          recorded_at?: string | null
          restaurant_id: string
          shift_id?: string | null
          table_id?: string | null
          visit_id?: string | null
          waiter_id: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          recorded_at?: string | null
          restaurant_id?: string
          shift_id?: string | null
          table_id?: string | null
          visit_id?: string | null
          waiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_events_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_events_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_events_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_events_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_insights: {
        Row: {
          created_at: string | null
          expires_at: string | null
          generated_at: string | null
          id: string
          insight_text: string
          insight_type: string
          metrics_snapshot: Json | null
          period_end: string | null
          period_start: string | null
          recommendations: Json | null
          restaurant_id: string
          waiter_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          insight_text: string
          insight_type: string
          metrics_snapshot?: Json | null
          period_end?: string | null
          period_start?: string | null
          recommendations?: Json | null
          restaurant_id: string
          waiter_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          insight_text?: string
          insight_type?: string
          metrics_snapshot?: Json | null
          period_end?: string | null
          period_start?: string | null
          recommendations?: Json | null
          restaurant_id?: string
          waiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_insights_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_insights_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          name: string | null
          restaurant_id: string
          role: string | null
          status: string | null
          token: string
          waiter_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          name?: string | null
          restaurant_id: string
          role?: string | null
          status?: string | null
          token: string
          waiter_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          name?: string | null
          restaurant_id?: string
          role?: string | null
          status?: string | null
          token?: string
          waiter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          restaurant_id: string
          sender_user_id: string | null
          sender_waiter_id: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          restaurant_id: string
          sender_user_id?: string | null
          sender_waiter_id?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          restaurant_id?: string
          sender_user_id?: string | null
          sender_waiter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "staff_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_messages_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_messages_sender_waiter_id_fkey"
            columns: ["sender_waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_metrics_daily: {
        Row: {
          avg_tip_percentage: number | null
          avg_turnover_minutes: number | null
          covers_served: number | null
          created_at: string | null
          efficiency_score: number | null
          events_count: number | null
          id: string
          metric_date: string
          restaurant_id: string
          tables_served: number | null
          total_sales: number | null
          total_tips: number | null
          updated_at: string | null
          waiter_id: string
        }
        Insert: {
          avg_tip_percentage?: number | null
          avg_turnover_minutes?: number | null
          covers_served?: number | null
          created_at?: string | null
          efficiency_score?: number | null
          events_count?: number | null
          id?: string
          metric_date: string
          restaurant_id: string
          tables_served?: number | null
          total_sales?: number | null
          total_tips?: number | null
          updated_at?: string | null
          waiter_id: string
        }
        Update: {
          avg_tip_percentage?: number | null
          avg_turnover_minutes?: number | null
          covers_served?: number | null
          created_at?: string | null
          efficiency_score?: number | null
          events_count?: number | null
          id?: string
          metric_date?: string
          restaurant_id?: string
          tables_served?: number | null
          total_sales?: number | null
          total_tips?: number | null
          updated_at?: string | null
          waiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_metrics_daily_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_metrics_daily_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_preferences: {
        Row: {
          avoid_clopening: boolean
          created_at: string
          id: string
          max_hours_per_week: number | null
          max_shifts_per_week: number | null
          min_hours_per_week: number | null
          notes: string | null
          preferred_roles: string[]
          preferred_sections: string[]
          preferred_shift_types: string[]
          restaurant_id: string
          updated_at: string
          waiter_id: string
        }
        Insert: {
          avoid_clopening?: boolean
          created_at?: string
          id?: string
          max_hours_per_week?: number | null
          max_shifts_per_week?: number | null
          min_hours_per_week?: number | null
          notes?: string | null
          preferred_roles?: string[]
          preferred_sections?: string[]
          preferred_shift_types?: string[]
          restaurant_id: string
          updated_at?: string
          waiter_id: string
        }
        Update: {
          avoid_clopening?: boolean
          created_at?: string
          id?: string
          max_hours_per_week?: number | null
          max_shifts_per_week?: number | null
          min_hours_per_week?: number | null
          notes?: string | null
          preferred_roles?: string[]
          preferred_sections?: string[]
          preferred_shift_types?: string[]
          restaurant_id?: string
          updated_at?: string
          waiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_preferences_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_preferences_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: true
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_score_history: {
        Row: {
          calculated_at: string | null
          change_reason: string | null
          id: string
          metrics_snapshot: Json | null
          new_score: number
          new_tier: string | null
          previous_score: number | null
          previous_tier: string | null
          waiter_id: string
        }
        Insert: {
          calculated_at?: string | null
          change_reason?: string | null
          id?: string
          metrics_snapshot?: Json | null
          new_score: number
          new_tier?: string | null
          previous_score?: number | null
          previous_tier?: string | null
          waiter_id: string
        }
        Update: {
          calculated_at?: string | null
          change_reason?: string | null
          id?: string
          metrics_snapshot?: Json | null
          new_score?: number
          new_tier?: string | null
          previous_score?: number | null
          previous_tier?: string | null
          waiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_score_history_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_requirements: {
        Row: {
          created_at: string
          day_of_week: number
          effective_from: string | null
          effective_until: string | null
          end_time: string
          id: string
          is_prime_shift: boolean
          max_staff: number | null
          min_staff: number
          notes: string | null
          restaurant_id: string
          role: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          effective_from?: string | null
          effective_until?: string | null
          end_time: string
          id?: string
          is_prime_shift?: boolean
          max_staff?: number | null
          min_staff?: number
          notes?: string | null
          restaurant_id: string
          role?: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          effective_from?: string | null
          effective_until?: string | null
          end_time?: string
          id?: string
          is_prime_shift?: boolean
          max_staff?: number | null
          min_staff?: number
          notes?: string | null
          restaurant_id?: string
          role?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staffing_requirements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      table_availability_blocks: {
        Row: {
          active: boolean
          actor_user_id: string | null
          command_id: string | null
          created_at: string | null
          id: string
          reason: string | null
          restaurant_id: string
          table_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          actor_user_id?: string | null
          command_id?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          restaurant_id: string
          table_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          actor_user_id?: string | null
          command_id?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          restaurant_id?: string
          table_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_availability_blocks_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_availability_blocks_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_camera_crops: {
        Row: {
          approved_at: string
          approved_by_user_id: string | null
          bbox: Json
          camera_source_id: string
          created_at: string
          frame_height: number
          frame_reference_md5: string | null
          frame_reference_path: string | null
          frame_reference_uri: string | null
          frame_width: number
          id: string
          is_active: boolean
          oriented_rect: Json | null
          polygon: Json
          restaurant_id: string
          source: string
          source_metadata: Json
          superseded_at: string | null
          superseded_by: string | null
          table_id: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string
          approved_by_user_id?: string | null
          bbox: Json
          camera_source_id: string
          created_at?: string
          frame_height: number
          frame_reference_md5?: string | null
          frame_reference_path?: string | null
          frame_reference_uri?: string | null
          frame_width: number
          id?: string
          is_active?: boolean
          oriented_rect?: Json | null
          polygon: Json
          restaurant_id: string
          source: string
          source_metadata?: Json
          superseded_at?: string | null
          superseded_by?: string | null
          table_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string
          approved_by_user_id?: string | null
          bbox?: Json
          camera_source_id?: string
          created_at?: string
          frame_height?: number
          frame_reference_md5?: string | null
          frame_reference_path?: string | null
          frame_reference_uri?: string | null
          frame_width?: number
          id?: string
          is_active?: boolean
          oriented_rect?: Json | null
          polygon?: Json
          restaurant_id?: string
          source?: string
          source_metadata?: Json
          superseded_at?: string | null
          superseded_by?: string | null
          table_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "table_camera_crops_camera_source_id_fkey"
            columns: ["camera_source_id"]
            isOneToOne: false
            referencedRelation: "camera_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_camera_crops_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_camera_crops_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "table_camera_crops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_camera_crops_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_classification_gemini_usage: {
        Row: {
          calls_used: number
          created_at: string
          quota_key: string
          updated_at: string
          usage_date: string
        }
        Insert: {
          calls_used?: number
          created_at?: string
          quota_key: string
          updated_at?: string
          usage_date: string
        }
        Update: {
          calls_used?: number
          created_at?: string
          quota_key?: string
          updated_at?: string
          usage_date?: string
        }
        Relationships: []
      }
      table_classifier_outputs: {
        Row: {
          created_at: string
          delivery_id: string | null
          id: string
          model_version: string | null
          output: Json
          restaurant_id: string
          semantic_key: string
          table_id: string
        }
        Insert: {
          created_at?: string
          delivery_id?: string | null
          id?: string
          model_version?: string | null
          output?: Json
          restaurant_id: string
          semantic_key: string
          table_id: string
        }
        Update: {
          created_at?: string
          delivery_id?: string | null
          id?: string
          model_version?: string | null
          output?: Json
          restaurant_id?: string
          semantic_key?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_classifier_outputs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_classifier_outputs_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_clean_references: {
        Row: {
          approved_at: string
          approved_by: string | null
          byte_size: number
          camera_id: string | null
          content_type: string
          created_at: string
          crop_version: string | null
          data: string
          deactivated_at: string | null
          fixture_notes: string | null
          id: string
          invalidated_reason: string | null
          restaurant_id: string
          source: string
          source_delivery_row_id: string | null
          status: string
          table_id: string
        }
        Insert: {
          approved_at?: string
          approved_by?: string | null
          byte_size: number
          camera_id?: string | null
          content_type?: string
          created_at?: string
          crop_version?: string | null
          data: string
          deactivated_at?: string | null
          fixture_notes?: string | null
          id?: string
          invalidated_reason?: string | null
          restaurant_id: string
          source?: string
          source_delivery_row_id?: string | null
          status?: string
          table_id: string
        }
        Update: {
          approved_at?: string
          approved_by?: string | null
          byte_size?: number
          camera_id?: string | null
          content_type?: string
          created_at?: string
          crop_version?: string | null
          data?: string
          deactivated_at?: string | null
          fixture_notes?: string | null
          id?: string
          invalidated_reason?: string | null
          restaurant_id?: string
          source?: string
          source_delivery_row_id?: string | null
          status?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_clean_references_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_clean_references_source_delivery_row_id_fkey"
            columns: ["source_delivery_row_id"]
            isOneToOne: false
            referencedRelation: "table_triplet_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_clean_references_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_current_states: {
        Row: {
          confidence: number | null
          model_version: string | null
          observed_at_utc: string
          restaurant_id: string
          source_delivery_id: string | null
          state: string
          table_id: string
          updated_at_utc: string
        }
        Insert: {
          confidence?: number | null
          model_version?: string | null
          observed_at_utc: string
          restaurant_id: string
          source_delivery_id?: string | null
          state: string
          table_id: string
          updated_at_utc?: string
        }
        Update: {
          confidence?: number | null
          model_version?: string | null
          observed_at_utc?: string
          restaurant_id?: string
          source_delivery_id?: string | null
          state?: string
          table_id?: string
          updated_at_utc?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_current_states_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_current_states_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_inspector_debug_sessions: {
        Row: {
          armed_by: string | null
          expires_at: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          armed_by?: string | null
          expires_at: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          armed_by?: string | null
          expires_at?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_inspector_debug_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      table_manual_overrides: {
        Row: {
          active: boolean
          actor_user_id: string | null
          cleared_at: string | null
          created_at: string
          reason: string | null
          request_id: string | null
          restaurant_id: string
          state: string
          table_id: string
        }
        Insert: {
          active?: boolean
          actor_user_id?: string | null
          cleared_at?: string | null
          created_at?: string
          reason?: string | null
          request_id?: string | null
          restaurant_id: string
          state: string
          table_id: string
        }
        Update: {
          active?: boolean
          actor_user_id?: string | null
          cleared_at?: string | null
          created_at?: string
          reason?: string | null
          request_id?: string | null
          restaurant_id?: string
          state?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_manual_overrides_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_manual_overrides_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_ml_freezes: {
        Row: {
          active: boolean
          actor_user_id: string | null
          command_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          reason: string | null
          restaurant_id: string
          table_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          actor_user_id?: string | null
          command_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          reason?: string | null
          restaurant_id: string
          table_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          actor_user_id?: string | null
          command_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          reason?: string | null
          restaurant_id?: string
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_ml_freezes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_ml_freezes_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_model_registry: {
        Row: {
          activated_at: string | null
          bundle_path: string
          camera_id: string | null
          created_at: string
          engine_weight: number
          group_key: string
          id: string
          metadata: Json
          recipe: Json
          restaurant_id: string
          retired_at: string | null
          status: string
          table_id: string
          tag: string
          task: string
          threshold: number | null
          training_metrics: Json
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          bundle_path: string
          camera_id?: string | null
          created_at?: string
          engine_weight?: number
          group_key: string
          id?: string
          metadata?: Json
          recipe?: Json
          restaurant_id: string
          retired_at?: string | null
          status?: string
          table_id: string
          tag: string
          task?: string
          threshold?: number | null
          training_metrics?: Json
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          bundle_path?: string
          camera_id?: string | null
          created_at?: string
          engine_weight?: number
          group_key?: string
          id?: string
          metadata?: Json
          recipe?: Json
          restaurant_id?: string
          retired_at?: string | null
          status?: string
          table_id?: string
          tag?: string
          task?: string
          threshold?: number | null
          training_metrics?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_model_registry_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_model_registry_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_pos_snapshots: {
        Row: {
          check_closed_at: string | null
          has_open_order: boolean
          order_opened_at: string | null
          order_total: number | null
          payment_authorized: boolean
          payment_completed_at: string | null
          payment_method: string | null
          pos_order_id: string | null
          restaurant_id: string
          table_id: string
          tip_amount: number | null
          updated_at: string
        }
        Insert: {
          check_closed_at?: string | null
          has_open_order?: boolean
          order_opened_at?: string | null
          order_total?: number | null
          payment_authorized?: boolean
          payment_completed_at?: string | null
          payment_method?: string | null
          pos_order_id?: string | null
          restaurant_id: string
          table_id: string
          tip_amount?: number | null
          updated_at?: string
        }
        Update: {
          check_closed_at?: string | null
          has_open_order?: boolean
          order_opened_at?: string | null
          order_total?: number | null
          payment_authorized?: boolean
          payment_completed_at?: string | null
          payment_method?: string | null
          pos_order_id?: string | null
          restaurant_id?: string
          table_id?: string
          tip_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_pos_snapshots_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_pos_snapshots_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: true
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_realtime_cursors: {
        Row: {
          current_cursor: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          current_cursor?: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          current_cursor?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_realtime_cursors_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      table_realtime_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          cursor: number
          event_type: string
          id: string
          payload: Json
          request_id: string | null
          restaurant_id: string
          source: string
          source_delivery_id: string | null
          table_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          cursor: number
          event_type: string
          id?: string
          payload?: Json
          request_id?: string | null
          restaurant_id: string
          source: string
          source_delivery_id?: string | null
          table_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          cursor?: number
          event_type?: string
          id?: string
          payload?: Json
          request_id?: string | null
          restaurant_id?: string
          source?: string
          source_delivery_id?: string | null
          table_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_realtime_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_realtime_events_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_scan: {
        Row: {
          created_at: string
          id: number
          name: string | null
          scan_3d: string | null
          table_config_json: Json | null
          table_count: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          name?: string | null
          scan_3d?: string | null
          table_config_json?: Json | null
          table_count?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          name?: string | null
          scan_3d?: string | null
          table_config_json?: Json | null
          table_count?: number | null
        }
        Relationships: []
      }
      table_state_corrections: {
        Row: {
          actor_user_id: string | null
          camera_id: string | null
          command_id: string | null
          created_at: string
          crop_metadata: Json
          expires_at: string
          id: string
          metadata_json: Json
          occurred_at: string
          previous_state: string | null
          restaurant_id: string
          source: string
          table_id: string
          target_state: string
        }
        Insert: {
          actor_user_id?: string | null
          camera_id?: string | null
          command_id?: string | null
          created_at?: string
          crop_metadata?: Json
          expires_at?: string
          id?: string
          metadata_json?: Json
          occurred_at?: string
          previous_state?: string | null
          restaurant_id: string
          source?: string
          table_id: string
          target_state: string
        }
        Update: {
          actor_user_id?: string | null
          camera_id?: string | null
          command_id?: string | null
          created_at?: string
          crop_metadata?: Json
          expires_at?: string
          id?: string
          metadata_json?: Json
          occurred_at?: string
          previous_state?: string | null
          restaurant_id?: string
          source?: string
          table_id?: string
          target_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_state_corrections_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_state_corrections_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_state_events: {
        Row: {
          confidence: number | null
          created_at: string
          event_type: string
          id: string
          inferred_state: string
          metadata: Json
          pos_order_id: string | null
          restaurant_id: string
          source: string
          table_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          event_type: string
          id?: string
          inferred_state: string
          metadata?: Json
          pos_order_id?: string | null
          restaurant_id: string
          source: string
          table_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          event_type?: string
          id?: string
          inferred_state?: string
          metadata?: Json
          pos_order_id?: string | null
          restaurant_id?: string
          source?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_state_events_pos_order_id_fkey"
            columns: ["pos_order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_state_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_state_events_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_state_log: {
        Row: {
          actor_staff_id: string | null
          confidence: number | null
          created_at: string | null
          id: string
          metadata_json: Json | null
          new_state: string | null
          previous_state: string | null
          source: string | null
          staff_event_id: string | null
          table_id: string
        }
        Insert: {
          actor_staff_id?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          metadata_json?: Json | null
          new_state?: string | null
          previous_state?: string | null
          source?: string | null
          staff_event_id?: string | null
          table_id: string
        }
        Update: {
          actor_staff_id?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          metadata_json?: Json | null
          new_state?: string | null
          previous_state?: string | null
          source?: string | null
          staff_event_id?: string | null
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_state_log_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_triplet_deliveries: {
        Row: {
          artifact_id: string | null
          attempts: number
          camera_id: string | null
          completed_at: string | null
          crop_metadata: Json
          delivery_id: string | null
          id: string
          job_id: string | null
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          metadata: Json
          next_attempt_at: string | null
          perception: Json | null
          queued_at: string | null
          received_at: string
          restaurant_id: string
          result_payload: Json | null
          semantic_key: string
          stale_after: string | null
          started_at: string | null
          status: string
          table_id: string
        }
        Insert: {
          artifact_id?: string | null
          attempts?: number
          camera_id?: string | null
          completed_at?: string | null
          crop_metadata?: Json
          delivery_id?: string | null
          id?: string
          job_id?: string | null
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          metadata?: Json
          next_attempt_at?: string | null
          perception?: Json | null
          queued_at?: string | null
          received_at?: string
          restaurant_id: string
          result_payload?: Json | null
          semantic_key: string
          stale_after?: string | null
          started_at?: string | null
          status?: string
          table_id: string
        }
        Update: {
          artifact_id?: string | null
          attempts?: number
          camera_id?: string | null
          completed_at?: string | null
          crop_metadata?: Json
          delivery_id?: string | null
          id?: string
          job_id?: string | null
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          metadata?: Json
          next_attempt_at?: string | null
          perception?: Json | null
          queued_at?: string | null
          received_at?: string
          restaurant_id?: string
          result_payload?: Json | null
          semantic_key?: string
          stale_after?: string | null
          started_at?: string | null
          status?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_triplet_deliveries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_triplet_deliveries_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_triplet_delivery_frames: {
        Row: {
          byte_size: number
          content_type: string | null
          created_at: string
          data: string
          delivery_row_id: string
          filename: string | null
          frame_index: number
          id: string
        }
        Insert: {
          byte_size: number
          content_type?: string | null
          created_at?: string
          data: string
          delivery_row_id: string
          filename?: string | null
          frame_index: number
          id?: string
        }
        Update: {
          byte_size?: number
          content_type?: string | null
          created_at?: string
          data?: string
          delivery_row_id?: string
          filename?: string | null
          frame_index?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_triplet_delivery_frames_delivery_row_id_fkey"
            columns: ["delivery_row_id"]
            isOneToOne: false
            referencedRelation: "table_triplet_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          capacity: number
          created_at: string | null
          current_visit_id: string | null
          host_facing_label: string | null
          id: string
          internal_name: string | null
          is_active: boolean | null
          last_full_eval_at: string | null
          location: string | null
          pos_provider_slug: string | null
          pos_table_ref: string | null
          restaurant_id: string
          section_id: string | null
          state: string | null
          state_confidence: number | null
          state_engine_memory: Json
          state_updated_at: string | null
          table_number: string
          table_type: string
          updated_at: string | null
        }
        Insert: {
          capacity: number
          created_at?: string | null
          current_visit_id?: string | null
          host_facing_label?: string | null
          id?: string
          internal_name?: string | null
          is_active?: boolean | null
          last_full_eval_at?: string | null
          location?: string | null
          pos_provider_slug?: string | null
          pos_table_ref?: string | null
          restaurant_id: string
          section_id?: string | null
          state?: string | null
          state_confidence?: number | null
          state_engine_memory?: Json
          state_updated_at?: string | null
          table_number: string
          table_type: string
          updated_at?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string | null
          current_visit_id?: string | null
          host_facing_label?: string | null
          id?: string
          internal_name?: string | null
          is_active?: boolean | null
          last_full_eval_at?: string | null
          location?: string | null
          pos_provider_slug?: string | null
          pos_table_ref?: string | null
          restaurant_id?: string
          section_id?: string | null
          state?: string | null
          state_confidence?: number | null
          state_engine_memory?: Json
          state_updated_at?: string | null
          table_number?: string
          table_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_meta: {
        Row: {
          picture: string
          user_id: string | null
        }
        Insert: {
          picture: string
          user_id?: string | null
        }
        Update: {
          picture?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          restaraunt_role: Database["public"]["Enums"]["restaraunt_role"] | null
          sole_annotation_access: boolean
          user: string
        }
        Insert: {
          restaraunt_role?:
            | Database["public"]["Enums"]["restaraunt_role"]
            | null
          sole_annotation_access?: boolean
          user: string
        }
        Update: {
          restaraunt_role?:
            | Database["public"]["Enums"]["restaraunt_role"]
            | null
          sole_annotation_access?: boolean
          user?: string
        }
        Relationships: []
      }
      video_jobs: {
        Row: {
          camera_id: string | null
          completed_at: string | null
          created_at: string | null
          duration_seconds: number | null
          error_message: string | null
          fps: number | null
          id: string
          original_filename: string | null
          processed_frames: number | null
          restaurant_id: string
          started_at: string | null
          status: string | null
          stored_path: string | null
          total_frames: number | null
          updated_at: string | null
        }
        Insert: {
          camera_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          fps?: number | null
          id?: string
          original_filename?: string | null
          processed_frames?: number | null
          restaurant_id: string
          started_at?: string | null
          status?: string | null
          stored_path?: string | null
          total_frames?: number | null
          updated_at?: string | null
        }
        Update: {
          camera_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          fps?: number | null
          id?: string
          original_filename?: string | null
          processed_frames?: number | null
          restaurant_id?: string
          started_at?: string | null
          status?: string | null
          stored_path?: string | null
          total_frames?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_jobs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          actual_covers: number | null
          cleared_at: string | null
          created_at: string | null
          duration_minutes: number | null
          first_served_at: string | null
          id: string
          original_waiter_id: string | null
          party_size: number
          payment_at: string | null
          pos_transaction_id: string | null
          reservation_id: string | null
          restaurant_id: string
          seated_at: string
          shift_id: string
          subtotal: number | null
          table_id: string
          tax: number | null
          tip: number | null
          tip_percentage: number | null
          total: number | null
          transferred_at: string | null
          updated_at: string | null
          waiter_id: string
          waitlist_id: string | null
        }
        Insert: {
          actual_covers?: number | null
          cleared_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          first_served_at?: string | null
          id?: string
          original_waiter_id?: string | null
          party_size: number
          payment_at?: string | null
          pos_transaction_id?: string | null
          reservation_id?: string | null
          restaurant_id: string
          seated_at: string
          shift_id: string
          subtotal?: number | null
          table_id: string
          tax?: number | null
          tip?: number | null
          tip_percentage?: number | null
          total?: number | null
          transferred_at?: string | null
          updated_at?: string | null
          waiter_id: string
          waitlist_id?: string | null
        }
        Update: {
          actual_covers?: number | null
          cleared_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          first_served_at?: string | null
          id?: string
          original_waiter_id?: string | null
          party_size?: number
          payment_at?: string | null
          pos_transaction_id?: string | null
          reservation_id?: string | null
          restaurant_id?: string
          seated_at?: string
          shift_id?: string
          subtotal?: number | null
          table_id?: string
          tax?: number | null
          tip?: number | null
          tip_percentage?: number | null
          total?: number | null
          transferred_at?: string | null
          updated_at?: string | null
          waiter_id?: string
          waitlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_original_waiter_id_fkey"
            columns: ["original_waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_waitlist_id_fkey"
            columns: ["waitlist_id"]
            isOneToOne: false
            referencedRelation: "waitlist"
            referencedColumns: ["id"]
          },
        ]
      }
      waiter_alert_candidates: {
        Row: {
          alert_type: string
          candidate_at: string
          fire_after: string
          frame_delivery_id: string | null
          frame_delivery_row_id: string | null
          id: string
          resolution: string | null
          resolved: boolean
          restaurant_id: string
          service_context: Json
          service_state: string
          state_entered_at: string
          status: string
          table_id: string
          vlm_confidence: number | null
          vlm_deadline_at: string | null
          vlm_error: string | null
          vlm_policy_result: string | null
          vlm_prompt_version: string | null
          vlm_reason: string | null
          vlm_verdict: string | null
        }
        Insert: {
          alert_type: string
          candidate_at?: string
          fire_after: string
          frame_delivery_id?: string | null
          frame_delivery_row_id?: string | null
          id?: string
          resolution?: string | null
          resolved?: boolean
          restaurant_id: string
          service_context?: Json
          service_state: string
          state_entered_at: string
          status?: string
          table_id: string
          vlm_confidence?: number | null
          vlm_deadline_at?: string | null
          vlm_error?: string | null
          vlm_policy_result?: string | null
          vlm_prompt_version?: string | null
          vlm_reason?: string | null
          vlm_verdict?: string | null
        }
        Update: {
          alert_type?: string
          candidate_at?: string
          fire_after?: string
          frame_delivery_id?: string | null
          frame_delivery_row_id?: string | null
          id?: string
          resolution?: string | null
          resolved?: boolean
          restaurant_id?: string
          service_context?: Json
          service_state?: string
          state_entered_at?: string
          status?: string
          table_id?: string
          vlm_confidence?: number | null
          vlm_deadline_at?: string | null
          vlm_error?: string | null
          vlm_policy_result?: string | null
          vlm_prompt_version?: string | null
          vlm_reason?: string | null
          vlm_verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waiter_alert_candidates_frame_delivery_row_id_fkey"
            columns: ["frame_delivery_row_id"]
            isOneToOne: false
            referencedRelation: "table_triplet_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_alert_candidates_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_alert_candidates_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      waiter_alert_vlm_decisions: {
        Row: {
          candidate_id: string
          confidence: number | null
          created_at: string
          error: string | null
          frame_delivery_id: string | null
          frame_delivery_row_id: string | null
          id: string
          latency_ms: number | null
          model_name: string | null
          policy_result: string
          prompt_version: string
          raw_response: Json | null
          reason: string | null
          restaurant_id: string
          table_id: string
          verdict: string | null
          visual_evidence: Json
        }
        Insert: {
          candidate_id: string
          confidence?: number | null
          created_at?: string
          error?: string | null
          frame_delivery_id?: string | null
          frame_delivery_row_id?: string | null
          id?: string
          latency_ms?: number | null
          model_name?: string | null
          policy_result: string
          prompt_version: string
          raw_response?: Json | null
          reason?: string | null
          restaurant_id: string
          table_id: string
          verdict?: string | null
          visual_evidence?: Json
        }
        Update: {
          candidate_id?: string
          confidence?: number | null
          created_at?: string
          error?: string | null
          frame_delivery_id?: string | null
          frame_delivery_row_id?: string | null
          id?: string
          latency_ms?: number | null
          model_name?: string | null
          policy_result?: string
          prompt_version?: string
          raw_response?: Json | null
          reason?: string | null
          restaurant_id?: string
          table_id?: string
          verdict?: string | null
          visual_evidence?: Json
        }
        Relationships: [
          {
            foreignKeyName: "waiter_alert_vlm_decisions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "waiter_alert_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_alert_vlm_decisions_frame_delivery_row_id_fkey"
            columns: ["frame_delivery_row_id"]
            isOneToOne: false
            referencedRelation: "table_triplet_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_alert_vlm_decisions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_alert_vlm_decisions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      waiter_alerts: {
        Row: {
          alert_type: string
          dismissed_at: string | null
          dismissed_by: string | null
          fired_at: string
          id: string
          priority: string
          restaurant_id: string
          table_id: string
        }
        Insert: {
          alert_type: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          fired_at?: string
          id?: string
          priority: string
          restaurant_id: string
          table_id: string
        }
        Update: {
          alert_type?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          fired_at?: string
          id?: string
          priority?: string
          restaurant_id?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiter_alerts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_alerts_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      waiter_service_interval_observations: {
        Row: {
          active_table_count: number | null
          alert_type: string
          created_at: string
          duration_seconds: number
          ended_at: string
          id: string
          interval_type: string
          local_daypart: string | null
          party_size: number | null
          restaurant_id: string
          service_phase: string
          source: string
          started_at: string
          table_id: string
        }
        Insert: {
          active_table_count?: number | null
          alert_type: string
          created_at?: string
          duration_seconds: number
          ended_at: string
          id?: string
          interval_type: string
          local_daypart?: string | null
          party_size?: number | null
          restaurant_id: string
          service_phase: string
          source: string
          started_at: string
          table_id: string
        }
        Update: {
          active_table_count?: number | null
          alert_type?: string
          created_at?: string
          duration_seconds?: number
          ended_at?: string
          id?: string
          interval_type?: string
          local_daypart?: string | null
          party_size?: number | null
          restaurant_id?: string
          service_phase?: string
          source?: string
          started_at?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiter_service_interval_observations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_service_interval_observations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      waiter_service_visits: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          occurred_at: string
          restaurant_id: string
          service_phase: string | null
          service_state: string | null
          source: string
          table_id: string
          waiter_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          occurred_at?: string
          restaurant_id: string
          service_phase?: string | null
          service_state?: string | null
          source?: string
          table_id: string
          waiter_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          occurred_at?: string
          restaurant_id?: string
          service_phase?: string | null
          service_state?: string | null
          source?: string
          table_id?: string
          waiter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waiter_service_visits_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_service_visits_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_service_visits_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      waiter_tier_history: {
        Row: {
          changed_at: string | null
          id: string
          new_score: number | null
          new_tier: string
          previous_score: number | null
          previous_tier: string | null
          reason: string | null
          waiter_id: string
        }
        Insert: {
          changed_at?: string | null
          id?: string
          new_score?: number | null
          new_tier: string
          previous_score?: number | null
          previous_tier?: string | null
          reason?: string | null
          waiter_id: string
        }
        Update: {
          changed_at?: string | null
          id?: string
          new_score?: number | null
          new_tier?: string
          previous_score?: number | null
          previous_tier?: string | null
          reason?: string | null
          waiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiter_tier_history_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      waiters: {
        Row: {
          composite_score: number | null
          created_at: string | null
          email: string | null
          employee_auth_enabled: boolean
          employee_login_id: string | null
          id: string
          is_active: boolean | null
          last_employee_login_at: string | null
          name: string
          phone: string | null
          pin_hash: string | null
          pin_set_at: string | null
          pos_passcode: string
          pos_permissions_override: Json
          pos_role: string
          restaurant_id: string
          role: string | null
          roles: string[] | null
          suggested_weekly_hours: number | null
          tier: string | null
          tier_updated_at: string | null
          total_covers: number | null
          total_sales: number | null
          total_shifts: number | null
          total_tables_served: number | null
          total_tips: number | null
          updated_at: string | null
        }
        Insert: {
          composite_score?: number | null
          created_at?: string | null
          email?: string | null
          employee_auth_enabled?: boolean
          employee_login_id?: string | null
          id?: string
          is_active?: boolean | null
          last_employee_login_at?: string | null
          name: string
          phone?: string | null
          pin_hash?: string | null
          pin_set_at?: string | null
          pos_passcode?: string
          pos_permissions_override?: Json
          pos_role?: string
          restaurant_id: string
          role?: string | null
          roles?: string[] | null
          suggested_weekly_hours?: number | null
          tier?: string | null
          tier_updated_at?: string | null
          total_covers?: number | null
          total_sales?: number | null
          total_shifts?: number | null
          total_tables_served?: number | null
          total_tips?: number | null
          updated_at?: string | null
        }
        Update: {
          composite_score?: number | null
          created_at?: string | null
          email?: string | null
          employee_auth_enabled?: boolean
          employee_login_id?: string | null
          id?: string
          is_active?: boolean | null
          last_employee_login_at?: string | null
          name?: string
          phone?: string | null
          pin_hash?: string | null
          pin_set_at?: string | null
          pos_passcode?: string
          pos_permissions_override?: Json
          pos_role?: string
          restaurant_id?: string
          role?: string | null
          roles?: string[] | null
          suggested_weekly_hours?: number | null
          tier?: string | null
          tier_updated_at?: string | null
          total_covers?: number | null
          total_sales?: number | null
          total_shifts?: number | null
          total_tables_served?: number | null
          total_tips?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waiters_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          arrived_at: string | null
          assigned_table_id: string | null
          checked_in_at: string | null
          created_at: string | null
          guest_email: string | null
          guest_email_normalized: string | null
          guest_id: string | null
          guest_name: string | null
          guest_phone: string | null
          guest_phone_e164: string | null
          guest_phone_last4: string | null
          id: string
          joined_at: string | null
          last_transition_source: string | null
          location_preference: string | null
          no_show_at: string | null
          notes: string | null
          notes_internal: string | null
          notified_at: string | null
          party_name: string | null
          party_size: number
          quoted_wait_minutes: number | null
          removed_at: string | null
          restaurant_id: string
          seated_at: string | null
          seating_preference: string | null
          source: string | null
          stale_hold_reason: string | null
          stale_hold_set_at: string | null
          stale_hold_set_by_user_id: string | null
          stale_hold_until: string | null
          status: string | null
          status_reason: string | null
          table_preference: string | null
          updated_at: string | null
          version: number
          visit_id: string | null
          walked_away_at: string | null
        }
        Insert: {
          arrived_at?: string | null
          assigned_table_id?: string | null
          checked_in_at?: string | null
          created_at?: string | null
          guest_email?: string | null
          guest_email_normalized?: string | null
          guest_id?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guest_phone_e164?: string | null
          guest_phone_last4?: string | null
          id?: string
          joined_at?: string | null
          last_transition_source?: string | null
          location_preference?: string | null
          no_show_at?: string | null
          notes?: string | null
          notes_internal?: string | null
          notified_at?: string | null
          party_name?: string | null
          party_size: number
          quoted_wait_minutes?: number | null
          removed_at?: string | null
          restaurant_id: string
          seated_at?: string | null
          seating_preference?: string | null
          source?: string | null
          stale_hold_reason?: string | null
          stale_hold_set_at?: string | null
          stale_hold_set_by_user_id?: string | null
          stale_hold_until?: string | null
          status?: string | null
          status_reason?: string | null
          table_preference?: string | null
          updated_at?: string | null
          version?: number
          visit_id?: string | null
          walked_away_at?: string | null
        }
        Update: {
          arrived_at?: string | null
          assigned_table_id?: string | null
          checked_in_at?: string | null
          created_at?: string | null
          guest_email?: string | null
          guest_email_normalized?: string | null
          guest_id?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guest_phone_e164?: string | null
          guest_phone_last4?: string | null
          id?: string
          joined_at?: string | null
          last_transition_source?: string | null
          location_preference?: string | null
          no_show_at?: string | null
          notes?: string | null
          notes_internal?: string | null
          notified_at?: string | null
          party_name?: string | null
          party_size?: number
          quoted_wait_minutes?: number | null
          removed_at?: string | null
          restaurant_id?: string
          seated_at?: string | null
          seating_preference?: string | null
          source?: string | null
          stale_hold_reason?: string | null
          stale_hold_set_at?: string | null
          stale_hold_set_by_user_id?: string | null
          stale_hold_until?: string | null
          status?: string | null
          status_reason?: string | null
          table_preference?: string | null
          updated_at?: string | null
          version?: number
          visit_id?: string | null
          walked_away_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_assigned_table_id_fkey"
            columns: ["assigned_table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          restaurant_id: string
          waitlist_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          restaurant_id: string
          waitlist_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          restaurant_id?: string
          waitlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_events_waitlist_id_fkey"
            columns: ["waitlist_id"]
            isOneToOne: false
            referencedRelation: "waitlist"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          external_event_id: string | null
          id: string
          payload: Json
          processed_at: string | null
          provider_slug: string
          restaurant_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          external_event_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider_slug: string
          restaurant_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          external_event_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider_slug?: string
          restaurant_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calibration_emit_event: {
        Args: { p_event_type: string; p_payload: Json; p_restaurant_id: string }
        Returns: string
      }
      calibration_upsert_crop: {
        Args: {
          p_approved_by_user_id: string
          p_bbox: Json
          p_camera_source_id: string
          p_frame_height: number
          p_frame_reference_md5: string
          p_frame_reference_path: string
          p_frame_reference_uri: string
          p_frame_width: number
          p_oriented_rect: Json
          p_polygon: Json
          p_restaurant_id: string
          p_source: string
          p_source_metadata: Json
          p_table_id: string
        }
        Returns: {
          approved_at: string
          approved_by_user_id: string | null
          bbox: Json
          camera_source_id: string
          created_at: string
          frame_height: number
          frame_reference_md5: string | null
          frame_reference_path: string | null
          frame_reference_uri: string | null
          frame_width: number
          id: string
          is_active: boolean
          oriented_rect: Json | null
          polygon: Json
          restaurant_id: string
          source: string
          source_metadata: Json
          superseded_at: string | null
          superseded_by: string | null
          table_id: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "table_camera_crops"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      shire_slugify: { Args: { value: string }; Returns: string }
      shire_unique_restaurant_slug: {
        Args: { exclude_restaurant_id?: string; source_name: string }
        Returns: string
      }
    }
    Enums: {
      annotation_state:
        | "UNLABELED"
        | "DIRTY"
        | "CLEAN"
        | "OCCUPIED"
        | "DISCARDED"
      image_annotation_audit_state:
        | "UNAUDITED"
        | "NEEDS_REVIEW"
        | "AUDITED"
        | "AMBIGUOUS"
        | "DISCARDED"
        | "NEEDS_AUDIT"
      restaraunt_role: "owner" | "employee" | "developer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      annotation_state: [
        "UNLABELED",
        "DIRTY",
        "CLEAN",
        "OCCUPIED",
        "DISCARDED",
      ],
      image_annotation_audit_state: [
        "UNAUDITED",
        "NEEDS_REVIEW",
        "AUDITED",
        "AMBIGUOUS",
        "DISCARDED",
        "NEEDS_AUDIT",
      ],
      restaraunt_role: ["owner", "employee", "developer"],
    },
  },
} as const
