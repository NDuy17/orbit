# Orbit

Orbit là ứng dụng mạng xã hội dựa trên vị trí, được xây dựng bằng Expo, React Native và Supabase. Mục tiêu của app là giúp người dùng nhìn thấy những người liên quan quanh mình, kết bạn, nhắn tin và nhận thông báo theo thời gian gần như tức thì, nhưng vẫn có các lớp kiểm soát riêng tư như ẩn vị trí và chia sẻ vị trí gần đúng.

Ứng dụng có hai phần chính:

- App người dùng: chạy trên mobile và web bằng Expo.
- Orbit Admin: dashboard quản trị chạy bằng React + Vite trong thư mục `admin/`.

## App Làm Gì

Orbit xoay quanh bản đồ và quan hệ bạn bè:

- Người dùng đăng ký, đăng nhập và giữ phiên bằng Supabase Auth.
- Màn hình bản đồ hiển thị vị trí của chính mình, bạn bè và người được gợi ý.
- Bạn bè luôn được ưu tiên hiển thị trên bản đồ nếu họ đang bật chia sẻ vị trí, kể cả khi họ ở xa hơn bán kính gợi ý.
- Người chưa kết bạn chỉ được đưa vào vùng gợi ý tối đa 5km quanh vị trí hiện tại.
- Người dùng có thể gửi lời mời kết bạn, chấp nhận hoặc từ chối lời mời.
- Khi đã là bạn bè, người dùng có thể nhắn tin và xem vị trí bạn bè theo logic bạn bè hiện tại.
- Màn hình thông báo nhận thông báo admin, thông báo realtime và lời mời kết bạn.
- Tin nhắn có badge theo số người nhắn; trong từng hội thoại có số tin nhắn chưa đọc của người đó.
- Admin có thể quản lý người dùng, báo cáo, góp ý và gửi thông báo ngay hoặc lên lịch.

## Luồng Chính

### Bản Đồ Và Vị Trí

Map là màn hình trung tâm của Orbit. App lấy vị trí thiết bị, lưu vị trí hiện tại lên Supabase, rồi đọc danh sách người có thể hiển thị.

Quy tắc hiện tại:

- Bạn bè: hiển thị trên bản đồ nếu có vị trí visible, không bị giới hạn bởi bán kính gợi ý.
- Người chưa kết bạn: chỉ hiển thị nếu nằm trong vùng gợi ý tối đa 5km.
- Nếu bật Ghost Mode, vị trí của người dùng được ẩn khỏi bản đồ người khác.
- Nếu bật vị trí gần đúng, app dùng tọa độ public đã làm tròn cho người chưa kết bạn.
- Bạn bè được xem vị trí chính xác hơn theo dữ liệu mà backend/RLS cho phép.
- Dẫn đường trên map dùng tuyến đường bộ qua OSRM, có chọn phương tiện, chọn nhiều tuyến nếu API trả về, bắt đầu chỉ đường để map bám theo vị trí, tự tính lại tuyến khi đi lệch/sai hướng và có thể thoát chỉ đường bất cứ lúc nào. Thời gian dự kiến được tính theo tốc độ riêng của đi bộ, xe máy và ô tô thay vì dùng chung một duration. Xe máy ưu tiên tuyến tránh cao tốc/đường cấm, có kiểm tra thêm dữ liệu OSM để loại đoạn `motorcycle=no`, `motor_vehicle=no`, `motorway` không cho xe máy; nếu dữ liệu chưa đủ rõ thì app vẫn đưa tuyến tham khảo kèm cảnh báo.

Thiết kế này tách rõ hai nhu cầu: bạn bè là quan hệ đã có ngữ cảnh nên cần duy trì khả năng thấy nhau; còn người lạ chỉ là gợi ý khám phá nên phải giới hạn chặt theo khoảng cách.

### Bạn Bè

Tính năng bạn bè gồm:

- Gửi lời mời kết bạn.
- Nhận lời mời realtime qua Supabase.
- Chấp nhận hoặc từ chối lời mời.
- Xóa bạn bè.
- Tự cập nhật trạng thái quan hệ trong danh sách, bản đồ và hồ sơ.

Khi có lời mời kết bạn mới, thông báo xuất hiện ở màn hình Thông báo. Bấm vào thông báo sẽ chuyển sang phần lời mời kết bạn để xử lý như luồng kết bạn bình thường.

### Tin Nhắn

Tin nhắn dùng Supabase Realtime để cập nhật hội thoại. App giữ cache tin nhắn cục bộ để mở lại nhanh hơn, đồng thời tính unread theo từng tài khoản:

- Badge ở tab Tin nhắn chỉ hiển thị số người đang nhắn chưa đọc.
- Trong danh sách hội thoại, từng người nhắn có badge riêng thể hiện số tin chưa đọc của người đó.
- Khi mở hội thoại, app đánh dấu riêng hội thoại đó là đã xem cho đúng tài khoản hiện tại.

### Thông Báo

Thông báo gồm hai nguồn:

- Thông báo admin gửi từ dashboard.
- Thông báo phát sinh từ quan hệ bạn bè, ví dụ lời mời kết bạn.

App dùng Supabase Realtime để user nhận thông báo mà không cần bấm làm mới. Badge thông báo được lưu theo từng user, nên tài khoản này xem thông báo sẽ không làm mất badge của tài khoản khác.

Lưu ý kỹ thuật: với Expo SDK 55, remote push notification trên Android không chạy trong Expo Go. App đã tránh crash bằng cách bỏ qua native push khi chạy Android Expo Go. Muốn push thật ngoài app/background trên Android cần development build.

### Orbit Admin

Admin dashboard phục vụ kiểm duyệt và vận hành:

- Tổng quan số liệu người dùng, tin nhắn, báo cáo.
- Quản lý người dùng và trạng thái tài khoản.
- Xử lý báo cáo.
- Xem và xử lý góp ý.
- Gửi thông báo ngay hoặc lên lịch.

Admin dùng cache kiểu stale-while-revalidate để chuyển tab không bị trắng bảng hoặc hiện loading lại liên tục.

## Kiến Trúc

```text
.
├── App.js
├── index.js
├── metro.config.js
├── src/
│   ├── components/
│   ├── constants/
│   ├── data/
│   ├── navigation/
│   ├── screens/
│   ├── services/
│   ├── store/
│   ├── theme/
│   └── utils/
├── admin/
│   ├── src/
│   └── package.json
└── supabase/
    ├── schema.sql
    └── migrations/
```

Các lớp chính:

- `screens/`: màn hình app như Map, Friends, Chat, Notifications, Profile.
- `services/`: giao tiếp Supabase, location, message, friend, notification.
- `store/`: Zustand store cho user, message, notification, location, theme.
- `components/`: UI dùng lại như map, bottom sheet, avatar, button.
- `admin/src/`: dashboard quản trị React + Vite.
- `supabase/`: schema, migration và các bảng backend.

## Công Nghệ

- Expo SDK 55.
- React Native và React Native Web.
- React Navigation.
- Zustand.
- Supabase Auth, Postgres, Realtime và RLS.
- Expo Location.
- Expo Notifications cho môi trường hỗ trợ native push.
- Vite + React cho admin dashboard.

## Chạy Local

Cài dependency:

```bash
npm install
```

Chạy Expo:

```bash
npm start
```

Chạy bằng tunnel để điện thoại khác mạng vẫn quét QR được:

```bash
npx.cmd expo start --tunnel --clear
```

Chạy web:

```bash
npm run web
```

Chạy admin:

```bash
npm --prefix admin install
npm --prefix admin run dev
```

## Biến Môi Trường

Mobile/web Expo dùng:

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_EAS_PROJECT_ID=your_eas_project_id
```

Admin dùng:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Không đưa service role key vào client hoặc admin frontend. Các thao tác đặc quyền nên đi qua server hoặc Supabase Edge Function.

## Cơ Sở Dữ Liệu

Các bảng chính:

- `profiles`: hồ sơ người dùng.
- `locations`: vị trí, trạng thái visible, vị trí chính xác và vị trí public.
- `friends`: quan hệ bạn bè hai chiều.
- `friend_requests`: lời mời kết bạn.
- `messages`: tin nhắn.
- `encounters`: ghi nhận gặp gần nhau.
- `notifications`: thông báo admin/user.
- `push_tokens`: token push khi môi trường hỗ trợ.
- `admin_users`: quyền truy cập dashboard.
- `reports`, `feedbacks`: báo cáo và góp ý.

RLS phải được bật và test kỹ cho production, đặc biệt với `locations`, `messages`, `friends`, `friend_requests` và `profiles`.

## Phân Tích Thiết Kế

Orbit xử lý dữ liệu vị trí nên rủi ro riêng tư cao hơn một mạng xã hội thông thường. Vì vậy logic sản phẩm nên phân biệt rõ ba nhóm dữ liệu:

- Dữ liệu của chính mình: cần chính xác để điều hướng và cập nhật vị trí.
- Dữ liệu bạn bè: có thể hiển thị rộng hơn vì đã có quan hệ xã hội, nhưng vẫn phải tôn trọng Ghost Mode và RLS.
- Dữ liệu người lạ/gợi ý: phải giới hạn mạnh theo bán kính, hiện tại tối đa 5km.

Quy tắc “bạn bè luôn hiện trên map” giúp app có giá trị như một mạng xã hội thật, không chỉ là radar người gần đó. Ngược lại, giới hạn gợi ý người lạ trong 5km giúp giảm cảm giác bị theo dõi, giảm dữ liệu phải tải và tránh biến app thành công cụ dò vị trí quy mô lớn.

Realtime được dùng cho tin nhắn, thông báo và quan hệ bạn bè. Cách này tạo trải nghiệm giống mạng xã hội hiện đại: có sự kiện mới thì UI tự cập nhật. Tuy nhiên realtime cũng cần kiểm soát số lượng subscription, retry khi mất mạng và tránh refresh toàn màn hình gây giật.

Admin dashboard là phần vận hành quan trọng. Các hành động như cảnh báo, ban, gửi thông báo và xử lý báo cáo nên có audit log ở backend nếu app đi vào production.

## Kiểm Tra

Các lệnh kiểm tra thường dùng:

```bash
npm.cmd run lint
npm.cmd run admin:build
npx.cmd expo-doctor
npx.cmd expo export --platform android
npx.cmd expo export --platform web --clear
```

## Ghi Chú Vận Hành

- Android Expo Go không hỗ trợ remote push notification với Expo SDK 55; dùng development build nếu cần push thật.
- Nếu chạy điện thoại khác mạng, dùng `expo start --tunnel`.
- Nếu đổi logic Supabase schema, cần cập nhật migration và kiểm tra RLS.
- Không chạy song song nhiều lệnh export cùng ghi vào `dist`, vì có thể đụng quyền xóa file trên Windows.
