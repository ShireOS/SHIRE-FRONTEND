from __future__ import annotations

import asyncio
import json
import os
import uuid
from datetime import datetime, time, timezone
from decimal import Decimal

import asyncpg
from dotenv import load_dotenv

load_dotenv(os.environ.get("SHIRE_BACKEND_ENV", ".env"))

RESELLER_ID = uuid.UUID("4567634c-17db-4c91-b6e7-422e217708ff")

RESTAURANTS = [
    ("00000000-0000-4000-8000-000000000101", "Shire Temp Bistro", "shire-temp-bistro", "Casual American", "casual", ["American", "Brunch"], "101 Market St", "Charleston", "SC", "29401"),
    ("00000000-0000-4000-8000-000000000102", "Shire Temp Cantina", "shire-temp-cantina", "Modern Mexican", "casual", ["Mexican", "Cocktails"], "220 King St", "Charleston", "SC", "29401"),
    ("00000000-0000-4000-8000-000000000103", "Shire Temp Oyster Bar", "shire-temp-oyster-bar", "Seafood Bar", "bar", ["Seafood", "Raw Bar"], "18 Bay Ave", "Savannah", "GA", "31401"),
    ("00000000-0000-4000-8000-000000000104", "Shire Temp Pizzeria", "shire-temp-pizzeria", "Fast Casual Pizza", "fast_casual", ["Pizza", "Italian"], "44 Broad St", "Atlanta", "GA", "30303"),
    ("00000000-0000-4000-8000-000000000105", "Shire Temp Coffee House", "shire-temp-coffee-house", "Cafe Bakery", "cafe", ["Coffee", "Bakery"], "9 Main St", "Greenville", "SC", "29601"),
]

MENU_TEMPLATES = [
    ("Starters", "appetizer", "immediate", [("Crispy Calamari", 14, 5), ("Seasonal Hummus", 11, 4)]),
    ("Entrees", "entree", "by_course", [("House Burger", 18, 7), ("Grilled Salmon", 27, 12), ("Roasted Chicken", 24, 10)]),
    ("Desserts", "dessert", "hold", [("Chocolate Torte", 10, 3), ("Lemon Cheesecake", 9, 3)]),
    ("Drinks", "drink", "immediate", [("House Margarita", 13, 4), ("Draft IPA", 8, 2), ("Cold Brew", 5, 1)]),
]

JOB_CODES = [
    ("owner", "Owner", "owner", 0, False, None),
    ("manager", "Manager", "manager", 28, False, None),
    ("server", "Server", "waiter", 10, True, "server"),
    ("bartender", "Bartender", "normal", 12, True, "bartender"),
    ("host", "Host", "limited", 14, False, None),
    ("runner", "Runner", "normal", 9, True, "runner"),
    ("busser", "Busser", "normal", 9, True, "busser"),
    ("kitchen", "Kitchen", "normal", 16, False, None),
]


def role_permissions(role: str) -> dict:
    base = {
        "can_refund": False,
        "refund_limit": 0,
        "can_void": False,
        "can_comp": False,
        "can_discount": False,
        "discount_limit_percent": 0,
        "can_open_cash_drawer": False,
        "can_no_sale": False,
        "can_paid_in_out": False,
        "can_adjust_tips": False,
        "can_edit_menu": False,
        "can_edit_employees": False,
        "can_edit_schedules": False,
        "can_view_reports": False,
        "can_close_drawer": False,
        "can_close_day": False,
        "can_change_payment_settings": False,
        "require_manager_pin_for_approval": True,
    }
    if role == "owner":
        return {**base, **{k: True for k in base if k.startswith("can_")}, "refund_limit": 500, "discount_limit_percent": 100, "require_manager_pin_for_approval": False}
    if role == "manager":
        return {
            **base,
            "can_refund": True,
            "refund_limit": 150,
            "can_void": True,
            "can_comp": True,
            "can_discount": True,
            "discount_limit_percent": 50,
            "can_open_cash_drawer": True,
            "can_no_sale": True,
            "can_paid_in_out": True,
            "can_adjust_tips": True,
            "can_edit_menu": True,
            "can_edit_employees": True,
            "can_edit_schedules": True,
            "can_view_reports": True,
            "can_close_drawer": True,
            "can_close_day": True,
        }
    if role in {"server", "bartender", "cashier"}:
        return {
            **base,
            "can_discount": True,
            "discount_limit_percent": 20 if role == "bartender" else 15 if role == "server" else 10,
            "can_open_cash_drawer": role in {"bartender", "cashier"},
            "can_no_sale": role == "cashier",
            "can_close_drawer": role in {"bartender", "cashier"},
        }
    return base


def restaurant_config(name: str, slug: str, idx: int, completed: datetime) -> dict:
    return {
        "legal_business_name": f"{name} LLC",
        "dba_name": name,
        "ein": f"12-34567{idx:02d}",
        "legal_contact_name": "Jordan Reyes",
        "legal_contact_title": "Managing Partner",
        "legal_contact_email": f"legal+{slug}@shire.local",
        "legal_contact_phone": "555-0144",
        "tos_signature_data_url": "data:image/svg+xml;base64,PHN2Zy8+",
        "tos_signed_at": completed.isoformat(),
        "tos_version": "shire-placeholder-tos-v1",
        "bank_account_holder": f"{name} Operating",
        "bank_name": "Shire Test Bank",
        "bank_routing_number": "110000000",
        "bank_account_number": "000123456789",
        "payout_schedule": "daily",
        "refund_funding_source": "processor_balance",
        "batch_close_mode": "automatic",
        "batch_close_time": "03:00",
        "credit_card_tip_payout": "payroll",
        "refund_approval_threshold": "75",
        "challenges": ["speed_of_service", "labor_visibility", "multi_location_reporting"],
        "daily_covers_range": "150-300",
        "team_size_range": "25-50",
        "primary_goal": "Launch a clean multi-store POS rollout with accurate reporting.",
        "current_pos": "Toast",
        "current_scheduling": "7shifts",
        "current_reservations": "Resy",
        "service_modes": ["dine_in", "bar", "takeout", "catering"],
        "default_guest_flow": "host_seated",
        "reservation_timing_same_for_channels": False,
        "reservation_online_booking_horizon_days": "45",
        "reservation_online_lead_time_minutes": "120",
        "reservation_online_grace_period_minutes": "15",
        "reservation_staff_booking_horizon_days": "120",
        "reservation_staff_lead_time_minutes": "0",
        "reservation_staff_grace_period_minutes": "20",
        "reservation_slot_interval_minutes": "15",
        "reservation_min_party_size": "1",
        "reservation_max_party_size": "12",
        "reservation_default_duration_minutes": "90",
        "reservation_windows_follow_operating_hours": True,
        "menu_import_method": "manual",
        "team_setup_method": "invite",
        "invites": [],
        "closeout_settings": {
            "cash_tracking_mode": "per_terminal",
            "require_starting_bank": True,
            "blind_drawer_close": True,
            "allow_paid_in_out": True,
            "require_manager_for_drawer_open": True,
            "cash_drop_threshold": "500",
            "cash_variance_threshold": "10",
            "server_require_all_checks_closed": True,
            "server_require_tabs_closed": True,
            "server_require_cash_tips_declared": True,
            "server_require_credit_tips_reviewed": True,
            "server_require_tipout_entry": True,
            "server_require_manager_approval": True,
            "server_checkout_report_delivery": "print_and_email",
            "allow_clockout_before_checkout": False,
            "eod_batch_close_mode": "automatic",
            "eod_require_drawers_closed": True,
            "eod_require_servers_checked_out": True,
            "eod_require_open_checks_resolved": True,
            "eod_require_paid_outs_reviewed": True,
            "eod_require_tip_adjustments_reviewed": True,
            "eod_report_recipients": ["ops@shire.local"],
            "eod_reports": ["sales_summary", "labor", "tips", "cash_drawers"],
        },
        "check_workflow_settings": {
            "seat_numbers_enabled": True,
            "seat_number_required": False,
            "course_required": False,
            "allow_split_checks": True,
            "split_by_seat_enabled": True,
            "split_by_item_enabled": True,
            "split_evenly_enabled": True,
            "max_split_count": "12",
            "allow_partial_payments": True,
            "require_manager_for_split_after_payment": True,
            "allow_check_merge": True,
            "allow_table_transfer": True,
            "allow_server_transfer": True,
            "require_manager_for_transfer": False,
            "allow_bar_tabs": True,
            "tab_name_required": True,
            "card_preauth_required": True,
            "default_preauth_amount": "50",
            "allow_tabs_without_table": True,
            "auto_close_paid_tabs": True,
            "allow_reopen_closed_checks": True,
            "require_manager_for_reopen": True,
            "allow_send_before_required_modifiers": False,
            "allow_hold_and_fire": True,
            "default_order_fire_mode": "by_course",
            "default_hold_minutes": "10",
            "hold_preset_minutes": [5, 10, 15, 20],
            "allow_manual_hold": True,
            "allow_item_seat_move": True,
            "allow_multi_item_seat_move": True,
            "require_manager_for_item_move_after_send": True,
            "print_guest_check_by_default": False,
            "notes": "Seeded complete check workflow.",
        },
    }


async def main() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"], statement_cache_size=0)
    try:
        rids = [uuid.UUID(row[0]) for row in RESTAURANTS]
        completed = datetime.now(timezone.utc)
        async with conn.transaction():
            await conn.execute(
                """
                INSERT INTO public.profiles (id, first_name, last_name, phone, account_type, dashboard_prefs)
                VALUES ($1, 'reseller_temp', 'Temp', '555-0100', 'reseller', $2::jsonb)
                ON CONFLICT (id) DO UPDATE
                SET first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    phone = EXCLUDED.phone,
                    account_type = 'reseller',
                    dashboard_prefs = EXCLUDED.dashboard_prefs,
                    updated_at = now()
                """,
                RESELLER_ID,
                json.dumps({"default_landing": "reseller"}),
            )
            await conn.execute(
                """
                INSERT INTO public.user_roles ("user", sole_annotation_access, restaraunt_role)
                VALUES ($1, false, 'reseller')
                ON CONFLICT ("user") DO UPDATE
                SET restaraunt_role = 'reseller',
                    sole_annotation_access = false
                """,
                RESELLER_ID,
            )
            await conn.execute("DELETE FROM public.reseller_restaurant_groups WHERE reseller_id = $1", RESELLER_ID)
            await conn.execute("DELETE FROM public.restaurants WHERE id = ANY($1::uuid[])", rids)

            for idx, (rid_raw, name, slug, display, rtype, cuisines, address, city, state, postal) in enumerate(RESTAURANTS):
                rid = uuid.UUID(rid_raw)
                sections = ["Dining Room", "Bar", "Patio", "Private Dining"]
                floor_tables = [
                    {
                        "id": f"table-{n}",
                        "number": str(n),
                        "label": f"Table {n}",
                        "capacity": 2 + (n % 4) * 2,
                        "section": sections[(n - 1) % 4],
                        "income_type": sections[(n - 1) % 4],
                        "x": 60 + ((n - 1) % 4) * 160,
                        "y": 60 + ((n - 1) // 4) * 120,
                        "width": 90,
                        "height": 70,
                        "shape": "rect",
                    }
                    for n in range(1, 17)
                ]
                floor_plan = {"canvasWidth": 1000, "canvasHeight": 680, "tables": floor_tables, "sections": sections}
                config = restaurant_config(name, slug, idx, completed)

                await conn.execute(
                    """
                    INSERT INTO public.restaurants (
                      id, name, timezone, config, owner_id, slug, address, city, state, postal_code,
                      country, type, cuisine_types, phone, email, website, seating_capacity, table_count,
                      status, onboarding_step, onboarding_completed_at, floor_plan_data,
                      floor_plan_updated_at, public_slug, join_code, display_name
                    )
                    VALUES ($1,$2,'America/New_York',$3::jsonb,NULL,$4,$5,$6,$7,$8,'US',$9,$10::text[],
                            '555-0101',$11,$12,96,16,'active',20,$13,$14::jsonb,$13,$4,$15,$16)
                    """,
                    rid,
                    name,
                    json.dumps(config),
                    slug,
                    address,
                    city,
                    state,
                    postal,
                    rtype,
                    cuisines,
                    f"hello+{slug}@shire.local",
                    f"https://{slug}.shire.local",
                    completed,
                    json.dumps(floor_plan),
                    str(41010 + idx),
                    display,
                )
                await conn.execute(
                    """
                    INSERT INTO public.reseller_restaurants (reseller_id, restaurant_id, status, permissions, assigned_by)
                    VALUES ($1, $2, 'active', $3::jsonb, $1)
                    """,
                    RESELLER_ID,
                    rid,
                    json.dumps({"setup": True, "menu": True, "feedback": True, "team": True, "scheduling": True, "messaging": True, "payments": True}),
                )
                await conn.execute(
                    """
                    INSERT INTO public.restaurant_onboarding_state (
                      restaurant_id, site_id_alias, template_json, runtime_override_json,
                      floor_map_json, approved_tables_json, onboarding_sessions_json, pair_requests_json
                    )
                    VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,'{}'::jsonb,'{}'::jsonb)
                    """,
                    rid,
                    slug,
                    json.dumps({"source": "reseller_temp_seed", "complete": True}),
                    json.dumps(config),
                    json.dumps(floor_plan),
                    json.dumps({"tables": floor_tables}),
                )
                await conn.execute(
                    """
                    INSERT INTO public.pos_restaurant_configs (
                      id, tax_rate, backend_webhook_url, pos_password, payment_provider, payment_mode,
                      receipt_notes_enabled, receipt_note_max_chars, receipt_footer_message, tip_out_config,
                      auto_gratuity_enabled, auto_gratuity_party_threshold, auto_gratuity_rate,
                      seat_numbers_enabled, seat_number_required, course_required, split_by_seat_enabled,
                      split_by_item_enabled, allow_hold_and_fire, default_order_fire_mode, default_hold_minutes,
                      hold_preset_minutes, allow_manual_hold, allow_item_seat_move, allow_multi_item_seat_move,
                      require_manager_for_item_move_after_send, pricing_policy
                    )
                    VALUES ($1,0.0875,'https://web-production-5c5b4.up.railway.app','1111','helcim','test',
                            true,180,'Thank you for visiting Shire.',$2::jsonb,true,6,0.18,true,false,false,
                            true,true,true,'by_course',10,ARRAY[5,10,15,20],true,true,true,true,$3::jsonb)
                    """,
                    rid,
                    json.dumps({"mode": "role_based"}),
                    json.dumps({"enabled": True, "mode": "dual_pricing_posted_electronic", "rate": 0.035, "basis": "subtotal_plus_tax"}),
                )
                await conn.execute(
                    """
                    INSERT INTO public.restaurant_rate_plans (
                      restaurant_id, card_rate, pricing_mode, dual_pricing_enabled, applies_to, basis, notes, updated_by
                    )
                    VALUES ($1,0.035,'dual_pricing_posted_electronic',true,
                            ARRAY['credit','debit','terminal','gift_card'],'subtotal_plus_tax',
                            'Seeded reseller test rate plan',$2)
                    """,
                    rid,
                    RESELLER_ID,
                )
                for day in range(7):
                    closed = day == 0
                    await conn.execute(
                        """
                        INSERT INTO public.operating_hours (restaurant_id, day_of_week, open_time, close_time, is_closed)
                        VALUES ($1,$2,$3,$4,$5)
                        """,
                        rid,
                        day,
                        None if closed else time(10, 0),
                        None if closed else time(22, 0),
                        closed,
                    )
                for section in sections:
                    await conn.execute("INSERT INTO public.sections (restaurant_id, name, is_active) VALUES ($1,$2,true)", rid, section)

                tax_food = await conn.fetchval(
                    "INSERT INTO public.tax_rates (restaurant_id,name,rate,applies_to,is_default,is_inclusive,is_active) VALUES ($1,'Default Sales Tax',8.75,'all',true,false,true) RETURNING id",
                    rid,
                )
                tax_alc = await conn.fetchval(
                    "INSERT INTO public.tax_rates (restaurant_id,name,rate,applies_to,is_default,is_inclusive,is_active) VALUES ($1,'Alcohol Tax',10.25,'alcohol',false,false,true) RETURNING id",
                    rid,
                )
                await conn.execute(
                    """
                    INSERT INTO public.service_charges
                      (restaurant_id,name,charge_type,amount,applies_to,taxable,auto_apply,is_tip,is_active)
                    VALUES
                      ($1,'Large Party Service Charge','percentage',20,'large_party',true,true,true,true),
                      ($1,'Catering Delivery','fixed',25,'catering',true,false,false,true)
                    """,
                    rid,
                )
                await conn.execute(
                    """
                    INSERT INTO public.discount_rules (
                      restaurant_id,name,discount_type,applies_to,value_type,default_value,
                      editable_by_employee,min_value,max_value,allowed_roles,requires_manager_approval,
                      tax_behavior,reason_required,service_modes,days_of_week,is_active,sort_order
                    )
                    VALUES
                      ($1,'Manager Comp','comp','both','open',NULL,true,0,100,ARRAY['owner','manager'],true,'reduce_taxable_amount',true,ARRAY['dine_in','bar'],ARRAY[0,1,2,3,4,5,6],true,1),
                      ($1,'Employee Meal','employee_meal','item','percent',50,false,50,50,ARRAY['owner','manager'],true,'reduce_taxable_amount',true,ARRAY['dine_in'],ARRAY[1,2,3,4,5],true,2),
                      ($1,'Happy Hour Promo','promo','item','percent',15,false,15,15,ARRAY['owner','manager','server','bartender'],false,'reduce_taxable_amount',false,ARRAY['bar'],ARRAY[1,2,3,4,5],true,3)
                    """,
                    rid,
                )
                station_ids = {}
                for station_name, station_type, is_fallback, sort_order in [
                    ("Kitchen", "prep", True, 1),
                    ("Bar", "bar", False, 2),
                    ("Expo", "expo", False, 3),
                ]:
                    station_ids[station_name] = await conn.fetchval(
                        """
                        INSERT INTO public.kitchen_stations (
                          restaurant_id,name,slug,description,display_order,is_fallback,station_type,
                          kds_enabled,printer_role,service_modes,routing_notes,sort_order,is_active
                        )
                        VALUES ($1,$2,$3,$4,$5,$6,$7,true,$7,ARRAY['dine_in','bar','takeout'],'Seeded station',$5,true)
                        RETURNING id
                        """,
                        rid,
                        station_name,
                        station_name.lower(),
                        f"{station_name} station",
                        sort_order,
                        is_fallback,
                        station_type,
                    )
                for target_name, usage, host, station in [
                    ("Kitchen Printer", "kitchen", "192.168.88.10", "Kitchen"),
                    ("Bar Printer", "kitchen", "192.168.88.11", "Bar"),
                    ("Receipt Printer", "receipt", "192.168.88.12", "Expo"),
                ]:
                    target_id = await conn.fetchval(
                        """
                        INSERT INTO public.kitchen_output_targets
                          (restaurant_id,name,target_type,connection_type,config,is_active,usage)
                        VALUES ($1,$2,'printer','dummy',$3::jsonb,true,$4)
                        RETURNING id
                        """,
                        rid,
                        target_name,
                        json.dumps({"host": host, "port": 9100, "profile": "TM-T88V"}),
                        usage,
                    )
                    await conn.execute(
                        "INSERT INTO public.kitchen_station_targets (restaurant_id,station_id,target_id,priority,is_active) VALUES ($1,$2,$3,0,true)",
                        rid,
                        station_ids[station],
                        target_id,
                    )

                for category, course, fire_mode, items in MENU_TEMPLATES:
                    station_id = station_ids["Bar"] if category == "Drinks" else station_ids["Kitchen"]
                    tax_id = tax_alc if category == "Drinks" else tax_food
                    category_id = await conn.fetchval(
                        """
                        INSERT INTO public.menu_categories (
                          restaurant_id,name,tax_rate_id,routing_station_id,is_active,
                          default_course_type,default_fire_mode,prep_time_minutes,kds_display_group
                        )
                        VALUES ($1,$2,$3,$4,true,$5,$6,12,$2)
                        RETURNING id
                        """,
                        rid,
                        category,
                        tax_id,
                        station_id,
                        course,
                        fire_mode,
                    )
                    await conn.execute(
                        """
                        INSERT INTO public.kitchen_routing_rules (
                          restaurant_id,source_type,source_id,category,station_id,course_name,target_types,priority,is_active
                        )
                        VALUES ($1,'category',NULL,$2,$3,$4,ARRAY['printer','display'],10,true)
                        """,
                        rid,
                        category,
                        station_id,
                        course,
                    )
                    for item_name, price, cost in items:
                        await conn.execute(
                            """
                            INSERT INTO public.menu_items (
                              restaurant_id,pos_item_id,name,category,price,cost,is_available,description,
                              menu_category_id,availability_mode,availability_days,course_type,fire_mode,
                              routing_station_id,prep_time_minutes,kds_display_group,item_routing_notes,routing_confirmed_at
                            )
                            VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,'always',ARRAY[0,1,2,3,4,5,6],
                                    $9,$10,$11,12,$4,'Seeded route',now())
                            """,
                            rid,
                            f"{slug}-{item_name.lower().replace(' ', '-')}",
                            item_name,
                            category,
                            Decimal(str(price)),
                            Decimal(str(cost)),
                            f"Seeded {item_name} for reseller testing.",
                            category_id,
                            course,
                            fire_mode,
                            station_id,
                        )

                job_ids = {}
                for order, (code, label, tier, rate, tipped, tip_role) in enumerate(JOB_CODES):
                    job_ids[code] = await conn.fetchval(
                        """
                        INSERT INTO public.job_codes (
                          restaurant_id,code,label,permission_tier,default_hourly_rate,is_tipped,tipout_role,sort_order,is_active
                        )
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
                        RETURNING id
                        """,
                        rid,
                        code,
                        label,
                        tier,
                        Decimal(str(rate)),
                        tipped,
                        tip_role,
                        order,
                    )
                for role in ["owner", "manager", "server", "bartender", "cashier", "host", "runner", "busser", "kitchen"]:
                    p = role_permissions(role)
                    await conn.execute(
                        """
                        INSERT INTO public.pos_role_permissions (
                          restaurant_id,role_key,can_refund,refund_limit,can_void,can_comp,can_discount,
                          discount_limit_percent,can_open_cash_drawer,can_no_sale,can_paid_in_out,can_adjust_tips,
                          can_edit_menu,can_edit_employees,can_edit_schedules,can_view_reports,can_close_drawer,
                          can_close_day,can_change_payment_settings,require_manager_pin_for_approval
                        )
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
                        """,
                        rid,
                        role,
                        *[p[key] for key in [
                            "can_refund", "refund_limit", "can_void", "can_comp", "can_discount",
                            "discount_limit_percent", "can_open_cash_drawer", "can_no_sale", "can_paid_in_out",
                            "can_adjust_tips", "can_edit_menu", "can_edit_employees", "can_edit_schedules",
                            "can_view_reports", "can_close_drawer", "can_close_day", "can_change_payment_settings",
                            "require_manager_pin_for_approval",
                        ]],
                    )
                await conn.execute(
                    """
                    INSERT INTO public.pos_tip_payroll_settings (
                      restaurant_id,tip_distribution_mode,cash_tip_declaration_mode,credit_tip_payout_timing,
                      payroll_provider,payroll_export_frequency,tip_pooling_enabled,tip_pool_reset,tipout_basis,
                      tipout_sales_includes_tax,tipout_include_managers,require_tipout_at_checkout,
                      allow_manager_tip_adjustments,auto_withhold_credit_card_fees,credit_card_fee_percent,
                      role_tip_rules,notes
                    )
                    VALUES ($1,'role_based','required_checkout','payroll','Gusto','biweekly',true,'day','sales',
                            false,false,true,true,false,2.90,$2::jsonb,'Seeded complete tip policy')
                    """,
                    rid,
                    json.dumps([
                        {"role": "server", "eligible": True, "points": 10, "tipoutPercent": 3},
                        {"role": "bartender", "eligible": True, "points": 8, "tipoutPercent": 5},
                        {"role": "busser", "eligible": True, "points": 4, "tipoutPercent": 2},
                    ]),
                )
                for n, (staff_name, code, pos_role, rate, tipped) in enumerate([
                    ("Avery Manager", "manager", "manager", 28, False),
                    ("Sam Server", "server", "waiter", 10, True),
                    ("Blake Bartender", "bartender", "normal", 12, True),
                    ("Riley Host", "host", "normal", 14, False),
                    ("Casey Kitchen", "kitchen", "normal", 16, False),
                ], 1):
                    waiter_id = await conn.fetchval(
                        """
                        INSERT INTO public.waiters (
                          restaurant_id,name,email,phone,role,tier,total_shifts,total_covers,total_tips,
                          total_tables_served,total_sales,is_active,pos_passcode,pos_role,employee_login_id,
                          employee_auth_enabled,roles,job_code_id,hourly_rate,tip_pool_eligible,tip_pool_weight
                        )
                        VALUES ($1,$2,$3,'555-0199',$4,'standard',25,320,1850,160,14500,true,
                                $5,$6,$7,true,$8::text[],$9,$10,$11,$12)
                        RETURNING id
                        """,
                        rid,
                        staff_name,
                        f"{staff_name.lower().replace(' ', '.')}+{slug}@shire.local",
                        code,
                        str(1100 + n),
                        pos_role,
                        f"{code}{n}",
                        [code],
                        job_ids[code],
                        Decimal(str(rate)),
                        tipped,
                        Decimal("1.0") if tipped else Decimal("0"),
                    )
                    await conn.execute(
                        "INSERT INTO public.employee_job_codes (restaurant_id,waiter_id,job_code_id,hourly_rate_override,is_primary) VALUES ($1,$2,$3,$4,true)",
                        rid,
                        waiter_id,
                        job_ids[code],
                        Decimal(str(rate)),
                    )

            for group_id, group_name, color, members in [
                (uuid.UUID("11111111-1111-4111-8111-111111111101"), "Coastal Concepts", "#2EA6A1", [uuid.UUID(RESTAURANTS[0][0]), uuid.UUID(RESTAURANTS[2][0])]),
                (uuid.UUID("11111111-1111-4111-8111-111111111102"), "Downtown Growth", "#D4A854", [uuid.UUID(RESTAURANTS[1][0]), uuid.UUID(RESTAURANTS[3][0])]),
            ]:
                await conn.execute(
                    "INSERT INTO public.reseller_restaurant_groups (id,reseller_id,name,color) VALUES ($1,$2,$3,$4)",
                    group_id,
                    RESELLER_ID,
                    group_name,
                    color,
                )
                for rid in members:
                    await conn.execute(
                        "INSERT INTO public.reseller_restaurant_group_members (reseller_id,group_id,restaurant_id) VALUES ($1,$2,$3)",
                        RESELLER_ID,
                        group_id,
                        rid,
                    )

        rows = await conn.fetch("SELECT name,status,onboarding_step,onboarding_completed_at FROM public.restaurants WHERE id=ANY($1::uuid[]) ORDER BY name", rids)
        for row in rows:
            print(dict(row))
        groups = await conn.fetch(
            """
            SELECT g.name,g.color,count(m.restaurant_id) AS count
            FROM public.reseller_restaurant_groups g
            LEFT JOIN public.reseller_restaurant_group_members m ON m.group_id=g.id
            WHERE g.reseller_id=$1
            GROUP BY g.id
            ORDER BY g.name
            """,
            RESELLER_ID,
        )
        for group in groups:
            print(dict(group))
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
