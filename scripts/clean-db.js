import { existsSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'

const DATABASE_FILE = 'e-takip.db'
const APPLICATION_DIRECTORY = 'e-Takip'

function getAppDataDirectory() {
  if (process.platform === 'win32') {
    return process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
  }

  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support')
  }

  return process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
}

function printUsage() {
  console.log('Kullanım: node scripts/clean-db.js [--yes]')
  console.log('  Dry-run (varsayılan): hedefi gösterir, hiçbir dosyayı silmez.')
  console.log('  --yes: yalnızca gösterilen e-takip.db dosyasını kalıcı olarak siler.')
}

const args = process.argv.slice(2)
const unknownArguments = args.filter((argument) => argument !== '--yes' && argument !== '--help')

if (unknownArguments.length > 0) {
  console.error(`Bilinmeyen seçenek: ${unknownArguments.join(', ')}`)
  printUsage()
  process.exitCode = 2
} else if (args.includes('--help')) {
  printUsage()
} else {
  const userDataDirectory = resolve(getAppDataDirectory(), APPLICATION_DIRECTORY)
  const databasePath = resolve(userDataDirectory, DATABASE_FILE)

  // Savunma katmanı: hedef, hesaplanan userData dizininin doğrudan altındaki
  // tek ve sabit veritabanı dosyası değilse silme işlemini kesinlikle durdur.
  const expectedPath = resolve(userDataDirectory, DATABASE_FILE)
  if (databasePath !== expectedPath || basename(databasePath) !== DATABASE_FILE) {
    console.error('Güvenlik denetimi başarısız: beklenmeyen veritabanı hedefi.')
    process.exitCode = 2
  } else {
    console.log('e-Takip userData dizini:', userDataDirectory)
    console.log('Hedef veritabanı:', databasePath)
    console.warn('UYARI: Bu işlem yerel hasta ve reçete kayıtlarını geri alınamaz biçimde silebilir.')
    console.warn('Üretim verilerinde doğrulanmış, şifreli bir yedek olmadan kullanmayın.')

    if (!args.includes('--yes')) {
      console.log('DRY-RUN: Dosya silinmedi. Silmek için komutu --yes ile yeniden çalıştırın.')
    } else if (!existsSync(databasePath)) {
      console.log('Veritabanı bulunamadı; değişiklik yapılmadı.')
    } else {
      rmSync(databasePath, { force: false, recursive: false })
      console.log('Veritabanı silindi:', databasePath)
    }
  }
}
