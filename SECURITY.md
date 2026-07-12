# Güvenlik politikası

e-Takip bir portfolyo ve yerel iş akışı prototipidir. Mevcut sürüm gerçek hasta veya sağlık verisiyle üretim kullanımını desteklemez.

## Desteklenen sürümler

Proje üretim güvenlik desteği veya uzun süreli destek garantisi sunmaz. Güvenlik düzeltmeleri yalnızca en güncel `main` dalında değerlendirilir.

| Sürüm | Destek |
|---|---|
| `main` | En iyi gayret esasına göre |
| Eski sürümler | Desteklenmiyor |

## Güvenlik açığı bildirme

Bir güvenlik açığı bulduysanız lütfen herkese açık issue açmayın. Deponun **Security** sekmesindeki **Report a vulnerability** seçeneğini kullanarak özel bir GitHub Security Advisory taslağı gönderin.

Bildirimde mümkünse şunları paylaşın:

- Etkilenen sürüm veya commit
- Sorunun etkisi ve ön koşulları
- Tekrarlanabilir, kişisel veri içermeyen adımlar
- Varsa güvenli bir kavram kanıtı
- Önerilen azaltma veya düzeltme

Gerçek hasta kaydı, T.C. kimlik numarası, reçete, erişim anahtarı, parola veya başka bir kişisel veriyi bildirime eklemeyin. Yanlışlıkla böyle bir veri paylaşıldıysa bildirimde bunu açıkça belirtin.

## Yanıt süreci

Bildirim alındığında makul süre içinde alındı teyidi verilmeye, etki doğrulanmaya ve uygun bir düzeltme planı paylaşılmaya çalışılır. Bu açık kaynak portfolyo projesi için belirli bir yanıt veya düzeltme süresi taahhüt edilmez.

Doğrulanmış açıklıklar, gerekli düzeltme yayımlanana ve etkilenen kullanıcıların güncelleme yapabilmesi için makul süre geçene kadar gizli tutulmalıdır.

## Kapsam

Özellikle aşağıdaki konular güvenlik açısından değerlidir:

- Electron süreçleri arasında yetki yükseltme
- Oturum doğrulamasını veya pencere bağını aşma
- Keyfi dosya okuma/yazma ya da komut çalıştırma
- SQL enjeksiyonu veya veri bütünlüğü ihlali
- Hassas verinin renderer, log veya hata mesajına sızması
- Dış bağlantı ve gezinme kısıtlarını aşma

Sabit `admin / admin` hesabı, şifrelenmemiş yerel veritabanı ve eksik production yetkilendirmesi mevcut sürümün açıkça belgelenmiş sınırlarıdır. Bunlar gerçek veriyle kullanım için kabul edilebilir değildir; ancak tek başına yeni bir güvenlik açığı raporu sayılmaz.

## Güvenli geliştirme

- Depoya gerçek kişisel/sağlık verisi veya sır eklemeyin.
- Hata raporlarında yalnızca sentetik veri kullanın.
- Bağımlılık ve statik analiz kontrollerini çalıştırın: `npm audit`, `npm run lint`, `npm test`, `npm run build`.
- Güvenlik etkili değişikliklerde tehdit modelini ve geriye dönük uyumluluğu açıklayın.

Bu politika, KVKK veya başka bir mevzuata uyumluluk beyanı değildir.
