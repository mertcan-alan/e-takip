# Değişiklik günlüğü

Bu projedeki önemli değişiklikler bu dosyada belgelenir. Biçim [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) yaklaşımına dayanır ve proje [Semantic Versioning](https://semver.org/) ilkelerini izlemeyi hedefler.

## [Unreleased]

### Planlanan

- Güvenli kullanıcı ve rol yönetimi
- Şifreli yerel veri ve yedekleme
- Veritabanı entegrasyon ve Electron uçtan uca testleri
- Şema migration sistemi

## [1.0.0] - 2026-07-13

### Eklendi

- Yerel demo oturumu ve sınırlı Electron preload köprüsü
- Hasta oluşturma, arama, görüntüleme ve düzenleme akışı
- T.C. kimlik numarası doğrulama ve benzersizlik denetimi
- Hekim ve çoklu ilaç kalemleriyle transaction tabanlı reçete oluşturma
- Reçete listesi, ayrıntıları ve durum güncelleme akışı
- Genel bakış ve kategori istatistikleri
- Tarih aralığına göre raporlama
- Filtrelenebilir, salt okunur işlem günlüğü
- Resmî hizmet portallarından esinlenen duyarlı masaüstü arayüzü
- Electron süreç izolasyonu, pencereye bağlı oturum ve tek örnek kilidi
- Windows NSIS paketi üretme yapılandırması
- Node.js tabanlı kaynak, güvenlik ve veri sözleşmesi testleri
- GitHub Actions kalite akışı ve Dependabot yapılandırması

### Güvenlik notu

- Bu sürüm portfolyo/prototip kapsamındadır. Sabit demo hesabı ve şifrelenmemiş yerel veritabanı nedeniyle gerçek sağlık verisiyle üretim kullanımına uygun değildir.

[Unreleased]: https://github.com/mertcan-alan/e-takip/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mertcan-alan/e-takip/releases/tag/v1.0.0
