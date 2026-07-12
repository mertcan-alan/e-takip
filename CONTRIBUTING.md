# Katkıda bulunma rehberi

e-Takip'e katkıda bulunmayı düşündüğünüz için teşekkürler. Proje, anlaşılır eczane iş akışları ile güvenli Electron geliştirme pratiklerini sergileyen bir portfolyo prototipi olarak sürdürülür.

## Başlamadan önce

1. Açık issue'ları kontrol edin; büyük değişiklikler için önce bir özellik isteği açın.
2. Güvenlik açığını herkese açık issue ile bildirmeyin; [SECURITY.md](SECURITY.md) sürecini kullanın.
3. Gerçek hasta, reçete, hekim, eczane veya kimlik verisi kullanmayın.
4. Resmî kurum bağlantısı, tıbbi doğruluk veya KVKK uyumu iddiası eklemeyin.

## Yerel geliştirme

```bash
npm install
npm run dev
```

Küçük, odaklı değişiklikler yapın ve mevcut Electron/React mimarisini koruyun. Yeni bağımlılık eklemeden önce neden gerekli olduğunu pull request açıklamasında belirtin.

## Kod ve kullanıcı deneyimi ilkeleri

- Renderer'a doğrudan Node.js veya geniş IPC erişimi vermeyin.
- Tüm yazma işlemlerinde ana süreç doğrulamasını ve işlem günlüğünü koruyun.
- Kişisel veriyi log, hata metni veya ekran görüntüsüne taşımayın.
- Başarılı işlemi yalnızca veri katmanı gerçekten tamamlandıktan sonra bildirin.
- Klavye kullanımı, görünür odak, form etiketi, hata ve boş durumlarını destekleyin.
- Gerçek olmayan sayaç, rapor, tıbbi uyarı veya demo kaydı üretmeyin.
- Kullanıcıya klinik güvence veren ifadelerden kaçının.

## Değişiklikleri doğrulama

Pull request açmadan önce:

```bash
npm run lint
npm test
npm run build
npm audit
```

Değişiklik masaüstü akışını etkiliyorsa uygulamayı `npm run dev` ile çalıştırıp ilgili senaryoyu manuel olarak test edin. Kullanılan tüm test verileri kurgusal olmalıdır.

## Commit ve pull request

Anlaşılır, emir kipinde commit mesajları tercih edin. Örnekler:

```text
feat: add prescription date validation
fix: prevent duplicate patient identity number
docs: clarify local database limitations
```

Pull request açıklamasında:

- Sorunu ve çözümü özetleyin.
- Doğrulama adımlarını yazın.
- UI değişikliği varsa sentetik verili ekran görüntüsü ekleyin.
- Veri şeması, güvenlik veya geriye uyumluluk etkisini belirtin.
- İlgili issue'yu bağlayın.

## Veri tabanı değişiklikleri

Şema değişiklikleri geri alınabilir ve mevcut yerel veriyi koruyabilir biçimde tasarlanmalıdır. Migration stratejisi, veri kaybı ihtimali ve eski sürüm davranışı pull request içinde açıkça anlatılmalıdır.

## Davranış beklentisi

Saygılı, teknik gerekçesi açık ve kişiye değil probleme odaklanan iletişim beklenir. Kişisel veya hassas veri içeren içerikler güvenlik amacıyla haber verilmeksizin kaldırılabilir.
