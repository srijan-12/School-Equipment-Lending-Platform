# MongoDB collections

Single database (`lending_db` by default). All services connect with `MONGODB_URI`.

| Collection  | Purpose                                                                               |
| ----------- | ------------------------------------------------------------------------------------- |
| `users`     | `email`, `password_hash`, `full_name`, `role` (`student` \| `staff` \| `admin`)       |
| `equipment` | `name`, `category`, `condition`, `quantity_total`, `quantity_available`               |
| `bookings`  | `user_id`, `equipment_id`, `status`, `start_date`, `end_date`, `notes`, `approved_by` |

**Admin role:** seeded at auth-service startup (`admin@school.edu` / `demo123`) unless users already exist. Optional self-service admin registration requires env `REGISTER_ADMIN_SECRET` and JSON field `admin_secret` matching it.

**Equipment management:** only users with `role: admin` may create, update, or delete documents in `equipment` (REST handlers enforce this).
