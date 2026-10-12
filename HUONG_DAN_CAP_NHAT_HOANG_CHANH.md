# HOÀNG CHANH STUDIO — Bản sửa Face Reference

## Những gì đã thay đổi
- Tab Sản Xuất có nút **Tạo ảnh AI theo mặt gốc** ở mỗi cảnh.
- Nút gửi ảnh tham chiếu gốc (không chỉ tên nhân vật/Character ID) cùng prompt và hành động tới `/api/ai/generate-scene-image`.
- Ảnh tạo mới và ảnh tải từ iPhone đều ở trạng thái **Chờ duyệt thủ công**; không tự đánh dấu Đã duyệt.
- Ảnh mẫu gia đình `poster_comedy_studio` không được duyệt làm ảnh phân cảnh.
- Nếu thiếu API key, ảnh tham chiếu hoặc dịch vụ tạo ảnh bị giới hạn, giao diện báo lỗi và vẫn cho sao chép prompt để tạo ngoài.
- Mô hình tạo ảnh mặc định `gemini-2.5-flash-image`, có thể đổi bằng `GEMINI_IMAGE_MODEL` nếu tài khoản hỗ trợ model khác.

## Cần lưu ý
1. **Sao lưu dữ liệu các tập phim trước khi thay bản ứng dụng**. Các tập phim có thể lưu trong IndexedDB/localStorage trên thiết bị, không nằm trong ZIP mã nguồn.
2. Để tạo ảnh AI thật, môi trường chạy server phải có `GEMINI_API_KEY` hợp lệ và quyền dùng mô hình tạo ảnh. **Không ghi khóa vào file ZIP hoặc gửi khóa qua chat**.
3. AI không thể bảo đảm nhận diện 100%; phải xem ảnh mới và duyệt thủ công.
4. Chưa tích hợp tạo video tự động hoặc dựng 4 cảnh thành MP4. Nút tạo ảnh chỉ xử lý ảnh tĩnh.
5. Đây là bản chỉnh sửa mã nguồn; chưa xác nhận chạy thành công trong Google AI Studio của anh. Hãy thử trên bản sao (Remix/import), không ghi đè bản đang dùng trước khi sao lưu.

## Kiểm thử đề xuất
- Mở cảnh 1, xem ảnh tham chiếu Ba Chanh và nhấn **Tạo ảnh AI theo mặt gốc**.
- Nếu API thiếu/quota hết, phải có thông báo lỗi; không xuất hiện ảnh giả và không tự duyệt.
- Nếu có ảnh mới, trạng thái là **Chờ duyệt thủ công**. Kiểm tra khuôn mặt, hộp bánh quy và hành động rồi bấm duyệt.
- Thử tải ảnh khác từ iPhone: ảnh phải ở trạng thái chưa duyệt.
