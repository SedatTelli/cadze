export const HELP_HTML = `
<div class="hc-cover">
  <div class="hc-cover-logo">⬡</div>
  <div class="hc-cover-name">CADZE</div>
  <div class="hc-cover-sub">Ücretsiz &amp; Açık Kaynak CAD Görüntüleyici</div>
  <div class="hc-cover-sub">Free &amp; Open Source CAD Viewer</div>
  <div class="hc-cover-meta">v0.2 · DXF · DWG · STL · Windows</div>
</div>

<div class="hc-toc">
  <div class="hc-toc-title">İçindekiler / Table of Contents</div>
  <a href="#s1">1. Giriş / Introduction</a>
  <a href="#s2">2. Dosya Açma / Opening Files</a>
  <a href="#s3">3. Navigasyon / Navigation</a>
  <a href="#s4">4. Araçlar / Tools</a>
  <a href="#s5">5. Ölçüm / Measurement</a>
  <a href="#s6">6. OSNAP (Nesne Yakalama)</a>
  <a href="#s7">7. Katmanlar / Layers</a>
  <a href="#s8">8. Özellikler Paneli / Properties</a>
  <a href="#s9">9. Not Sistemi / Notes</a>
  <a href="#s10">10. Dışa Aktarma / Export</a>
  <a href="#s11">11. Komut Satırı / Command Line</a>
  <a href="#s12">12. Klavye Kısayolları / Keyboard Shortcuts</a>
  <a href="#s13">13. Ayarlar / Settings</a>
  <a href="#s14">14. Birim Sistemi / Unit System</a>
  <a href="#s15">15. Görünüm / View</a>
  <a href="#s16">16. Sorun Giderme / Troubleshooting</a>
</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="s1" class="hc-section">1. Giriş / Introduction</h2>

<div class="hc-lang-block">
  <div class="hc-lang-tr">
    <p><strong>Cadze</strong>, DWG, DXF ve STL dosyalarını yerel olarak açıp görüntüleyen ücretsiz bir CAD görüntüleyicisidir. Hiçbir dosyanız buluta gönderilmez; tüm işlemler bilgisayarınızda gerçekleşir.</p>
    <p>Tauri v2 ve Pixi.js v8 (WebGL) ile geliştirilmiştir. GPU hızlandırması sayesinde 50.000+ nesne içeren büyük çizimleri sorunsuz görüntüler.</p>
    <div class="hc-callout hc-info">Cadze açık kaynaktır: github.com/sedattelli/cadze</div>
  </div>
  <div class="hc-lang-en">
    <p><strong>Cadze</strong> is a free CAD viewer that opens DWG, DXF, and STL files locally. No files are sent to the cloud; all processing happens on your computer.</p>
    <p>Built with Tauri v2 and Pixi.js v8 (WebGL), it smoothly renders large drawings with 50,000+ entities thanks to GPU acceleration.</p>
  </div>
</div>

<h3 class="hc-sub">Desteklenen Formatlar / Supported Formats</h3>
<table class="hc-table">
  <tr><th>Format</th><th>Açıklama / Description</th><th>Okuma / Read</th><th>Yazma / Write</th></tr>
  <tr><td>DXF</td><td>AutoCAD Drawing Exchange Format</td><td>✔ Tam / Full</td><td>v0.3'te / v0.3</td></tr>
  <tr><td>DWG</td><td>AutoCAD Binary Drawing (R10–R2025)</td><td>✔ LibreDWG</td><td>—</td></tr>
  <tr><td>STL</td><td>3D Stereolithography</td><td>◐ Yakında / Soon</td><td>—</td></tr>
</table>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="s2" class="hc-section">2. Dosya Açma / Opening Files</h2>

<div class="hc-lang-block">
  <div class="hc-lang-tr">
    <h3 class="hc-sub">Yöntem 1 — Sürükle &amp; Bırak</h3>
    <p>DWG, DXF veya STL dosyasını doğrudan Cadze penceresine sürükleyip bırakın.</p>
    <h3 class="hc-sub">Yöntem 2 — Dosya Tarayıcısı</h3>
    <p><strong>File → Open</strong> menüsüne tıklayın ya da <kbd>Ctrl+O</kbd> kısayolunu kullanın. Açılan yerel dosya diyaloğundan dosyanızı seçin.</p>
    <h3 class="hc-sub">Yöntem 3 — Son Açılanlar</h3>
    <p>Açılış ekranında <em>"Son Açılanlar"</em> bölümü son 5 dosyayı listeler. Tıklayarak hızlıca açabilirsiniz.</p>
    <h3 class="hc-sub">DWG Dönüşümü</h3>
    <p>DWG dosyaları LibreDWG kütüphanesi aracılığıyla otomatik olarak DXF'e dönüştürülür. Bu işlem arka planda birkaç saniye sürebilir. Dönüşüm tamamlanınca çizim ekranda görünür.</p>
    <div class="hc-callout hc-warn">Türkçe karakter içeren dosya yollarında dönüşüm sorunlarını önlemek için Cadze, girdiyi geçici bir ASCII yoluna kopyalar.</div>
    <h3 class="hc-sub">DWG Sürüm Uyarıları</h3>
    <ul>
      <li><strong>Yeşil</strong>: R10–R2013 → tam destek</li>
      <li><strong>Sarı uyarı çubuğu</strong>: R2018–R2025 → kısmi destek, bazı nesneler eksik görünebilir</li>
      <li><strong>Kırmızı uyarı</strong>: Bilinmeyen sürüm → en iyi sonuç için DXF'e dönüştürün</li>
    </ul>
  </div>
  <div class="hc-lang-en">
    <h3 class="hc-sub">Method 1 — Drag &amp; Drop</h3>
    <p>Drag a DWG, DXF, or STL file directly onto the Cadze window.</p>
    <h3 class="hc-sub">Method 2 — File Browser</h3>
    <p>Click <strong>File → Open</strong> or press <kbd>Ctrl+O</kbd> to open the native file dialog.</p>
    <h3 class="hc-sub">Method 3 — Recent Files</h3>
    <p>The start screen lists the last 5 opened files. Click any to reopen instantly.</p>
    <h3 class="hc-sub">DWG Conversion</h3>
    <p>DWG files are automatically converted to DXF via the LibreDWG library in the background.</p>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="s3" class="hc-section">3. Navigasyon / Navigation</h2>

<table class="hc-table">
  <tr><th>İşlem / Action</th><th>Fare / Mouse</th><th>Klavye / Keyboard</th></tr>
  <tr><td>Kaydırma / Pan</td><td>Sol tık + sürükle / Left click + drag</td><td>—</td></tr>
  <tr><td>Kaydırma / Pan (alternatif)</td><td>Orta tuş + sürükle / Middle button + drag</td><td>—</td></tr>
  <tr><td>Yakınlaştır / Zoom In</td><td>Tekerlek yukarı / Scroll up</td><td><kbd>+</kbd></td></tr>
  <tr><td>Uzaklaştır / Zoom Out</td><td>Tekerlek aşağı / Scroll down</td><td><kbd>−</kbd></td></tr>
  <tr><td>Tümünü Göster / Fit All</td><td>—</td><td><kbd>Home</kbd></td></tr>
  <tr><td>Pencere Zoom / Zoom Window</td><td>Z tuşu → sol tık sürükle / Z key → drag</td><td><kbd>Z</kbd></td></tr>
</table>

<div class="hc-lang-block">
  <div class="hc-lang-tr">
    <p><strong>Kaydırma hassasiyeti:</strong> Sol tık basıldıktan sonra farenin 5 piksel hareket etmesi gerekir; bu eşik aşılana kadar tıklama olarak değerlendirilir ve nesne seçimi tetiklenir.</p>
    <p><strong>Zoom Window:</strong> Z aracını seçin, sol tıklayarak dikdörtgen çizin. Fare bırakıldığında seçilen alan ekrana sığacak şekilde yakınlaştırılır.</p>
  </div>
  <div class="hc-lang-en">
    <p><strong>Pan threshold:</strong> The mouse must move 5 pixels after left-click before panning begins; clicks shorter than this trigger entity selection.</p>
    <p><strong>Zoom Window:</strong> Select the Z tool, drag a rectangle. On release, the selected area fills the screen.</p>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="s4" class="hc-section">4. Araçlar / Tools</h2>

<table class="hc-table">
  <tr><th>Araç / Tool</th><th>Kısayol / Key</th><th>Açıklama / Description</th></tr>
  <tr><td>Pan / Select</td><td><kbd>V</kbd> veya <kbd>P</kbd></td><td>Kaydır + nesne seç / Pan + entity select</td></tr>
  <tr><td>Zoom Window</td><td><kbd>Z</kbd></td><td>Dikdörtgen ile yakınlaştır / Rectangle zoom</td></tr>
  <tr><td>Measure Distance</td><td><kbd>M</kbd></td><td>İki nokta arası mesafe / Two-point distance</td></tr>
  <tr><td>Measure Angle</td><td><kbd>A</kbd></td><td>Üç nokta ile açı ölçüm / Three-point angle</td></tr>
  <tr><td>Measure Area</td><td><kbd>R</kbd></td><td>Çokgen alan ölçümü / Polygon area</td></tr>
  <tr><td>Add Note</td><td><kbd>N</kbd></td><td>Çizim üzerine not ekle / Add annotation</td></tr>
  <tr><td>Fit View</td><td><kbd>Home</kbd></td><td>Tümünü ekrana sığdır / Fit all to screen</td></tr>
</table>

<div class="hc-lang-block">
  <div class="hc-lang-tr">
    <p>Aktif araç sol araç çubuğunda ve <em>Tools</em> menüsünde mavi ile vurgulanır. <kbd>Esc</kbd> tuşu mevcut araç işlemini iptal eder (ölçüm noktası, alan çokgeni vb.).</p>
  </div>
  <div class="hc-lang-en">
    <p>The active tool is highlighted in blue in the left toolbar and Tools menu. <kbd>Esc</kbd> cancels the current tool operation (measurement point, polygon, etc.).</p>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="s5" class="hc-section">5. Ölçüm / Measurement</h2>

<h3 class="hc-sub">Mesafe Ölçümü / Distance Measurement <kbd>M</kbd></h3>
<div class="hc-lang-block">
  <div class="hc-lang-tr">
    <ol>
      <li><kbd>M</kbd> tuşuna basın ya da araç çubuğundan Measure'ı seçin.</li>
      <li>Başlangıç noktasına tıklayın. OSNAP aktifse nokta otomatik yakalanır.</li>
      <li>Bitiş noktasına tıklayın.</li>
      <li>Sonuç statusbar'da görünür: <strong>Mesafe · ΔX · ΔY</strong> seçili birimde.</li>
      <li>Bir sonraki tıklama yeni bir segment oluşturur (zincirleme ölçüm).</li>
      <li>Sağ tık veya <kbd>Esc</kbd> aktif noktayı iptal eder.</li>
      <li><kbd>Del</kbd> tüm ölçüm çizgilerini temizler.</li>
    </ol>
  </div>
  <div class="hc-lang-en">
    <ol>
      <li>Press <kbd>M</kbd> or click Measure in the toolbar.</li>
      <li>Click the start point. With OSNAP active, the point snaps automatically.</li>
      <li>Click the end point.</li>
      <li>Result appears in the status bar: <strong>Distance · ΔX · ΔY</strong> in the selected unit.</li>
      <li>Next click starts a new chained segment.</li>
      <li>Right-click or <kbd>Esc</kbd> cancels the active point.</li>
      <li><kbd>Del</kbd> clears all measurement lines.</li>
    </ol>
  </div>
</div>

<h3 class="hc-sub">Açı Ölçümü / Angle Measurement <kbd>A</kbd></h3>
<div class="hc-lang-block">
  <div class="hc-lang-tr">
    <ol>
      <li><kbd>A</kbd> tuşuna basın.</li>
      <li>Açının merkez noktasına (tepe) tıklayın.</li>
      <li>Birinci kola tıklayın.</li>
      <li>İkinci kola tıklayın. Açı derece olarak statusbar'da görünür.</li>
    </ol>
    <div class="hc-callout hc-info">3 nokta seçilince açı otomatik hesaplanır ve araç sıfırlanır.</div>
  </div>
  <div class="hc-lang-en">
    <ol>
      <li>Press <kbd>A</kbd>.</li>
      <li>Click the vertex (center) of the angle.</li>
      <li>Click the first arm.</li>
      <li>Click the second arm. The angle in degrees appears in the status bar.</li>
    </ol>
  </div>
</div>

<h3 class="hc-sub">Alan Ölçümü / Area Measurement <kbd>R</kbd></h3>
<div class="hc-lang-block">
  <div class="hc-lang-tr">
    <ol>
      <li><kbd>R</kbd> tuşuna basın.</li>
      <li>Çokgenin köşe noktalarına sırayla tıklayın.</li>
      <li>En az 3 nokta seçtikten sonra <strong>çift tıklayın</strong> → polygon kapanır.</li>
      <li>Alan ve çevre seçili birimde statusbar'da görünür.</li>
      <li>Sağ tık tüm noktaları iptal eder.</li>
    </ol>
  </div>
  <div class="hc-lang-en">
    <ol>
      <li>Press <kbd>R</kbd>.</li>
      <li>Click the polygon vertices in order.</li>
      <li>After at least 3 points, <strong>double-click</strong> to close the polygon.</li>
      <li>Area and perimeter appear in the status bar in the selected unit.</li>
    </ol>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="s6" class="hc-section">6. OSNAP (Nesne Yakalama / Object Snap)</h2>

<div class="hc-lang-block">
  <div class="hc-lang-tr">
    <p>OSNAP, ölçüm ve araç işlemleri sırasında fareyi mevcut nesnelerin özel noktalarına otomatik olarak yakalar; yüksek hassasiyet sağlar.</p>
    <h3 class="hc-sub">Snap Tipleri</h3>
    <table class="hc-table">
      <tr><th>Sembol / Symbol</th><th>Tip</th><th>Açıklama</th></tr>
      <tr><td>□ Yeşil kare</td><td>Endpoint</td><td>Çizgi ve polyline uç noktaları</td></tr>
      <tr><td>△ Sarı üçgen</td><td>Midpoint</td><td>Segment orta noktaları</td></tr>
      <tr><td>○ Mavi daire</td><td>Center</td><td>Daire, yay, elips merkezleri</td></tr>
    </table>
    <h3 class="hc-sub">OSNAP Aç/Kapat</h3>
    <ul>
      <li>Statusbar'daki <strong>OSNAP</strong> butonuna tıklayın</li>
      <li>Veya <kbd>F3</kbd> tuşuna basın</li>
      <li>Veya komut satırına <code>OSNAP</code> yazın</li>
    </ul>
    <p>Aktifken buton yeşil yanar. Kapalıyken tıklanan piksel koordinatı kullanılır.</p>
    <div class="hc-callout hc-info">Snap arama yarıçapı ekran pikselinde sabit tutulur (15px) ve zoom seviyesine göre sahne koordinatına dönüştürülür.</div>
  </div>
  <div class="hc-lang-en">
    <p>OSNAP automatically snaps the cursor to special points of existing entities during measurement and tool operations.</p>
    <table class="hc-table">
      <tr><th>Symbol</th><th>Type</th><th>Description</th></tr>
      <tr><td>□ Green square</td><td>Endpoint</td><td>Line and polyline endpoints</td></tr>
      <tr><td>△ Yellow triangle</td><td>Midpoint</td><td>Segment midpoints</td></tr>
      <tr><td>○ Blue circle</td><td>Center</td><td>Circle, arc, ellipse centers</td></tr>
    </table>
    <p>Toggle OSNAP with the <strong>OSNAP</strong> button in the status bar, <kbd>F3</kbd>, or type <code>OSNAP</code> in the command line.</p>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="s7" class="hc-section">7. Katmanlar / Layers</h2>

<div class="hc-lang-block">
  <div class="hc-lang-tr">
    <p>Sağ panelin üst bölümünde katman listesi yer alır. Her katman için renk noktası, isim ve iki kontrol butonu gösterilir.</p>
    <h3 class="hc-sub">Kontroller</h3>
    <table class="hc-table">
      <tr><th>Buton</th><th>İşlev</th></tr>
      <tr><td>❄ (Mavi)</td><td>Katmanı dondur / Freeze — görünmez + anlık yeniden render</td></tr>
      <tr><td>👁 (Göz)</td><td>Görünürlük toggle — tek katmanı göster/gizle</td></tr>
      <tr><td>All</td><td>Tüm katmanları göster (donmuş katmanlar hariç)</td></tr>
      <tr><td>None</td><td>Tüm katmanları gizle</td></tr>
    </table>
    <div class="hc-callout hc-warn">Donmuş (❄) katmanlar koyu renk ve üzeri çizgili görünür. Katman görünürlük değişikliklerinde çizim otomatik yeniden render edilir.</div>
    <h3 class="hc-sub">Menüden Yönetim</h3>
    <p><strong>Tools → Show All Layers</strong> ve <strong>Tools → Hide All Layers</strong> ile toplu kontrol yapılabilir. Komut satırında <code>LAON</code> / <code>LAOFF</code> yazılabilir.</p>
  </div>
  <div class="hc-lang-en">
    <p>The layer list is in the upper section of the right panel. Each layer shows a color dot, name, and two control buttons.</p>
    <table class="hc-table">
      <tr><th>Button</th><th>Function</th></tr>
      <tr><td>❄ (Blue)</td><td>Freeze layer — hidden + instant re-render</td></tr>
      <tr><td>👁 (Eye)</td><td>Visibility toggle — show/hide single layer</td></tr>
      <tr><td>All</td><td>Show all layers (except frozen)</td></tr>
      <tr><td>None</td><td>Hide all layers</td></tr>
    </table>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="s8" class="hc-section">8. Özellikler Paneli / Properties Panel</h2>

<div class="hc-lang-block">
  <div class="hc-lang-tr">
    <p>Sağ panelin alt bölümüdür. <strong>Pan aracındayken</strong> bir nesneye tıkladığınızda seçilen nesnenin özellikleri burada görünür.</p>
    <table class="hc-table">
      <tr><th>Alan</th><th>Nesne Tipi</th><th>Gösterilen Veri</th></tr>
      <tr><td>Type</td><td>Hepsi</td><td>Entity tipi: LINE, CIRCLE, ARC, LWPOLYLINE…</td></tr>
      <tr><td>Layer</td><td>Hepsi</td><td>Katman adı</td></tr>
      <tr><td>Length</td><td>LINE</td><td>Çizgi uzunluğu (seçili birimde)</td></tr>
      <tr><td>Radius</td><td>CIRCLE, ARC</td><td>Yarıçap</td></tr>
      <tr><td>Area</td><td>Kapalı POLYLINE</td><td>Alan (Shoelace formülü)</td></tr>
      <tr><td>Perimeter</td><td>Kapalı POLYLINE</td><td>Çevre uzunluğu</td></tr>
    </table>
    <div class="hc-callout hc-info">Alan ve çevre yalnızca <code>closed=true</code> olan LWPOLYLINE ve POLYLINE nesnelerinde görünür.</div>
  </div>
  <div class="hc-lang-en">
    <p>Located in the lower section of the right panel. With the <strong>Pan tool active</strong>, click an entity to see its properties.</p>
    <table class="hc-table">
      <tr><th>Field</th><th>Entity Type</th><th>Shown Data</th></tr>
      <tr><td>Type</td><td>All</td><td>Entity type: LINE, CIRCLE, ARC, LWPOLYLINE…</td></tr>
      <tr><td>Layer</td><td>All</td><td>Layer name</td></tr>
      <tr><td>Length</td><td>LINE</td><td>Line length (in selected unit)</td></tr>
      <tr><td>Radius</td><td>CIRCLE, ARC</td><td>Radius</td></tr>
      <tr><td>Area</td><td>Closed POLYLINE</td><td>Area (Shoelace formula)</td></tr>
      <tr><td>Perimeter</td><td>Closed POLYLINE</td><td>Perimeter length</td></tr>
    </table>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="s9" class="hc-section">9. Not Sistemi / Notes</h2>

<div class="hc-lang-block">
  <div class="hc-lang-tr">
    <h3 class="hc-sub">Not Ekleme</h3>
    <ol>
      <li><kbd>N</kbd> tuşuna basın ya da araç çubuğundan <em>Add Note</em>'u seçin.</li>
      <li>Çizim üzerinde not eklemek istediğiniz yere tıklayın.</li>
      <li>Açılan sarı metin kutusuna notunuzu yazın.</li>
      <li><kbd>Enter</kbd> ile kaydedin veya <kbd>Esc</kbd> ile iptal edin. <kbd>Shift+Enter</kbd> yeni satır ekler.</li>
    </ol>
    <h3 class="hc-sub">Not Görüntüleme</h3>
    <p>Notlar çizim üzerinde sarı nokta (●) olarak görünür. Noktanın üzerine gelindiğinde metin balonu açılır.</p>
    <h3 class="hc-sub">Not Silme</h3>
    <p>Balon içindeki <strong>✕</strong> butonuna tıklayın. <kbd>Ctrl+Z</kbd> ile geri alınabilir.</p>
    <h3 class="hc-sub">Notlar Konumlama</h3>
    <p>Notlar sahne koordinatlarında saklanır; pan ve zoom sırasında çizimle birlikte hareket ederler.</p>
    <h3 class="hc-sub">Tümünü Temizle</h3>
    <p><strong>Tools → Clear All Notes</strong> veya komut satırında <code>CLRNOTES</code>.</p>
    <h3 class="hc-sub">Geri Al / Ctrl+Z</h3>
    <p>Not ekleme ve silme işlemleri undo/redo yığınına kaydedilir. <kbd>Ctrl+Z</kbd> son işlemi geri alır, <kbd>Ctrl+Y</kbd> yeniden uygular.</p>
  </div>
  <div class="hc-lang-en">
    <h3 class="hc-sub">Adding Notes</h3>
    <ol>
      <li>Press <kbd>N</kbd> or select Add Note from the toolbar.</li>
      <li>Click anywhere on the drawing.</li>
      <li>Type your note in the yellow input box.</li>
      <li>Press <kbd>Enter</kbd> to save or <kbd>Esc</kbd> to cancel. <kbd>Shift+Enter</kbd> adds a new line.</li>
    </ol>
    <h3 class="hc-sub">Notes are anchored to scene coordinates</h3>
    <p>They move correctly with pan and zoom. Use ✕ in the bubble to delete, undoable with <kbd>Ctrl+Z</kbd>.</p>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="s10" class="hc-section">10. Dışa Aktarma / Export</h2>

<table class="hc-table">
  <tr><th>Format</th><th>Yol / Path</th><th>Kısayol</th><th>Açıklama</th></tr>
  <tr><td>PNG</td><td>File → Export PNG &nbsp;/&nbsp; Export çubuğu</td><td>—</td><td>Mevcut canvas tam çözünürlük</td></tr>
  <tr><td>PDF</td><td>File → Print/Export PDF &nbsp;/&nbsp; Export çubuğu</td><td><kbd>Ctrl+P</kbd></td><td>Tarayıcı print dialog; PDF olarak kaydet</td></tr>
  <tr><td>DXF</td><td>File → Export DXF</td><td>—</td><td>v0.3'te gelecek / Coming v0.3</td></tr>
</table>

<div class="hc-lang-block">
  <div class="hc-lang-tr">
    <h3 class="hc-sub">PDF İçin İpuçları</h3>
    <ul>
      <li><kbd>Ctrl+P</kbd> açıldığında "PDF Olarak Kaydet" / "Microsoft Print to PDF" seçeneğini kullanın.</li>
      <li>Baskı sırasında başlık çubuğu, menü, panel ve statusbar otomatik olarak gizlenir; yalnızca çizim baskıya gider.</li>
      <li>Ölçekli baskı için önce <em>Fit View</em> ile tüm çizimi ekrana sığdırın.</li>
    </ul>
  </div>
  <div class="hc-lang-en">
    <h3 class="hc-sub">PDF Tips</h3>
    <ul>
      <li>When <kbd>Ctrl+P</kbd> opens, choose "Save as PDF" or "Microsoft Print to PDF".</li>
      <li>All UI elements (title bar, menu, panels, status bar) are automatically hidden during printing.</li>
      <li>For scaled output, use Fit View first to center the drawing.</li>
    </ul>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="s11" class="hc-section">11. Komut Satırı / Command Line</h2>

<div class="hc-lang-block">
  <div class="hc-lang-tr">
    <p>Ekranın alt kısmındaki <strong>&gt;</strong> promptuna tıklayın ve komut yazın, ardından <kbd>Enter</kbd>'a basın.</p>
    <p><strong>Geçmiş:</strong> ↑↓ ok tuşları ile son 50 komutu gezebilirsiniz.</p>
  </div>
  <div class="hc-lang-en">
    <p>Click the <strong>&gt;</strong> prompt at the bottom and type a command, then press <kbd>Enter</kbd>.</p>
    <p><strong>History:</strong> Use ↑↓ arrow keys to navigate the last 50 commands.</p>
  </div>
</div>

<table class="hc-table">
  <tr><th>Komut / Command</th><th>Kısayollar / Aliases</th><th>İşlev / Function</th></tr>
  <tr><td>ZOOM / ZA / Z</td><td></td><td>Tümünü göster / Fit all</td></tr>
  <tr><td>ZOOMIN / ZI</td><td></td><td>Yakınlaştır / Zoom in</td></tr>
  <tr><td>ZOOMOUT / ZO</td><td></td><td>Uzaklaştır / Zoom out</td></tr>
  <tr><td>PAN / P</td><td></td><td>Pan aracı / Pan tool</td></tr>
  <tr><td>MEASURE / DIST</td><td></td><td>Mesafe ölçümü / Distance</td></tr>
  <tr><td>ANGLE / ANG</td><td></td><td>Açı ölçümü / Angle</td></tr>
  <tr><td>AREA</td><td></td><td>Alan ölçümü / Area</td></tr>
  <tr><td>NOTE</td><td></td><td>Not ekle / Add note</td></tr>
  <tr><td>OSNAP / OS</td><td></td><td>OSNAP aç/kapat / Toggle OSNAP</td></tr>
  <tr><td>UNDO / U</td><td></td><td>Geri al / Undo</td></tr>
  <tr><td>REDO</td><td></td><td>Yeniden yap / Redo</td></tr>
  <tr><td>BG / BACKGROUND</td><td></td><td>Arkaplan değiştir / Toggle background</td></tr>
  <tr><td>LAON / LAALL</td><td></td><td>Tüm katmanları göster</td></tr>
  <tr><td>LAOFF / LANONE</td><td></td><td>Tüm katmanları gizle</td></tr>
  <tr><td>CLRMEAS</td><td></td><td>Ölçümleri temizle</td></tr>
  <tr><td>MM / CM / M / INCH / FT / UNIT</td><td></td><td>Birimi ayarla / Set unit</td></tr>
  <tr><td>SCALE &lt;n&gt;</td><td></td><td>Ölçek çarpanı ayarla / Set scale factor</td></tr>
</table>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="s12" class="hc-section">12. Klavye Kısayolları / Keyboard Shortcuts</h2>

<table class="hc-table">
  <tr><th>Tuş / Key</th><th>İşlev / Function</th></tr>
  <tr><td><kbd>V</kbd> veya <kbd>P</kbd></td><td>Pan / Select aracı</td></tr>
  <tr><td><kbd>Z</kbd></td><td>Zoom Window aracı</td></tr>
  <tr><td><kbd>M</kbd></td><td>Mesafe ölçüm aracı</td></tr>
  <tr><td><kbd>A</kbd></td><td>Açı ölçüm aracı</td></tr>
  <tr><td><kbd>R</kbd></td><td>Alan ölçüm aracı</td></tr>
  <tr><td><kbd>N</kbd></td><td>Not ekleme aracı</td></tr>
  <tr><td><kbd>Home</kbd></td><td>Tümünü göster / Fit All</td></tr>
  <tr><td><kbd>+</kbd> / <kbd>=</kbd></td><td>Yakınlaştır</td></tr>
  <tr><td><kbd>−</kbd></td><td>Uzaklaştır</td></tr>
  <tr><td><kbd>B</kbd></td><td>Koyu/Açık arkaplan</td></tr>
  <tr><td><kbd>F3</kbd></td><td>OSNAP aç/kapat</td></tr>
  <tr><td><kbd>F11</kbd></td><td>Tam ekran / Fullscreen</td></tr>
  <tr><td><kbd>F1</kbd></td><td>Bu kılavuz / This manual</td></tr>
  <tr><td><kbd>Del</kbd></td><td>Ölçümleri temizle</td></tr>
  <tr><td><kbd>Ctrl+O</kbd></td><td>Dosya aç / Open file</td></tr>
  <tr><td><kbd>Ctrl+P</kbd></td><td>Yazdır / PDF / Print</td></tr>
  <tr><td><kbd>Ctrl+Z</kbd></td><td>Geri al / Undo</td></tr>
  <tr><td><kbd>Ctrl+Y</kbd></td><td>Yeniden yap / Redo</td></tr>
  <tr><td><kbd>Esc</kbd></td><td>Araç işlemini iptal et / Cancel tool op</td></tr>
  <tr><td>↑ / ↓ (komut satırında)</td><td>Komut geçmişi / Command history</td></tr>
</table>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="s13" class="hc-section">13. Ayarlar / Settings</h2>

<div class="hc-lang-block">
  <div class="hc-lang-tr">
    <p>Başlık çubuğundaki <strong>⚙</strong> butonuyla Ayarlar modalini açın.</p>
    <h3 class="hc-sub">Dil / Language</h3>
    <p>Cadze 5 dili destekler: <strong>Türkçe, English, Deutsch, 中文, 日本語</strong>.</p>
    <p>Seçim localStorage'a kaydedilir; uygulama yeniden başlatıldığında aynı dil kullanılır.</p>
    <p>Sistem dili otomatik algılanır. Tauri ortamında native OS locale API kullanılır.</p>
    <h3 class="hc-sub">Klavye Kısayolları Referansı</h3>
    <p>Ayarlar modali içinde tüm kısayollar özetlenmiştir.</p>
  </div>
  <div class="hc-lang-en">
    <p>Open Settings from the <strong>⚙</strong> button in the title bar.</p>
    <h3 class="hc-sub">Language</h3>
    <p>Cadze supports 5 languages: <strong>Türkçe, English, Deutsch, 中文, 日本語</strong>. The selection is persisted in localStorage. System language is auto-detected on first launch.</p>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="s14" class="hc-section">14. Birim Sistemi / Unit System</h2>

<div class="hc-lang-block">
  <div class="hc-lang-tr">
    <p>Statusbar'daki açılır listeden birimi seçin: <strong>unit · mm · cm · m · inch · ft</strong>.</p>
    <p>Seçilen birim tüm ölçüm sonuçlarına (mesafe, açı hariç, alan) uygulanır.</p>
    <p>Ölçek çarpanı için komut satırına <code>SCALE 1000</code> (örnek: DXF'de birim metre ise, m çıktısı için SCALE 1) yazın.</p>
    <table class="hc-table">
      <tr><th>DXF birimi</th><th>Seçilecek birim</th><th>SCALE komutu</th></tr>
      <tr><td>Milimetre</td><td>mm</td><td>SCALE 1</td></tr>
      <tr><td>Santimetre</td><td>cm</td><td>SCALE 1</td></tr>
      <tr><td>Metre</td><td>m</td><td>SCALE 1</td></tr>
      <tr><td>İnç</td><td>inch</td><td>SCALE 1</td></tr>
    </table>
  </div>
  <div class="hc-lang-en">
    <p>Select the unit from the status bar dropdown: <strong>unit · mm · cm · m · inch · ft</strong>. The selected unit is applied to all measurement results. Use the <code>SCALE &lt;n&gt;</code> command to set a multiplication factor.</p>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="s15" class="hc-section">15. Görünüm / View</h2>

<div class="hc-lang-block">
  <div class="hc-lang-tr">
    <h3 class="hc-sub">Arkaplan</h3>
    <p><kbd>B</kbd> tuşu veya <strong>View → Light Background</strong> ile koyu (#121214) ve açık (#f5f5f8) arkaplan arasında geçiş yapın.</p>
    <h3 class="hc-sub">Tam Ekran</h3>
    <p><kbd>F11</kbd> veya <strong>View → Fullscreen</strong> ile tam ekrana geçin. Çıkmak için tekrar <kbd>F11</kbd>'e basın.</p>
    <h3 class="hc-sub">FPS Sayacı</h3>
    <p>Statusbar sağında gerçek zamanlı FPS gösterilir. Normal çalışmada 60 FPS beklenir; büyük dosyalarda bu değer düşebilir.</p>
    <h3 class="hc-sub">Render Motoru</h3>
    <p>Pixi.js v8 + WebGL2 kullanılır. GPU hızlandırması aktif değilse Canvas2D'ye geri döner. WebGL desteklemeyen eski grafik kartlarında performans düşük olabilir.</p>
  </div>
  <div class="hc-lang-en">
    <h3 class="hc-sub">Background</h3>
    <p>Press <kbd>B</kbd> or use <strong>View → Light Background</strong> to toggle between dark (#121214) and light (#f5f5f8) backgrounds.</p>
    <h3 class="hc-sub">Fullscreen</h3>
    <p><kbd>F11</kbd> or <strong>View → Fullscreen</strong>. Press again to exit.</p>
    <h3 class="hc-sub">FPS Counter</h3>
    <p>Real-time FPS is shown at the right of the status bar. Expect 60 FPS normally; large files may reduce this.</p>
    <h3 class="hc-sub">Render Engine</h3>
    <p>Pixi.js v8 + WebGL2. Falls back to Canvas2D if GPU acceleration is unavailable.</p>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════ -->
<h2 id="s16" class="hc-section">16. Sorun Giderme / Troubleshooting</h2>

<table class="hc-table">
  <tr><th>Sorun / Problem</th><th>Çözüm / Solution</th></tr>
  <tr><td>DWG açılmıyor / Not opening</td><td>Dosya R2018+ ise kısmi destek uyarısı alabilirsiniz. DXF'e dönüştürün: <em>AutoCAD → Save As → DXF</em></td></tr>
  <tr><td>Türkçe yol hatası</td><td>Cadze otomatik olarak ASCII geçici yola kopyalar. Sorun devam ederse dosyayı Türkçesiz bir klasöre taşıyın.</td></tr>
  <tr><td>Çizim boş görünüyor</td><td>Katman panelinde tüm katmanların görünür olduğunu kontrol edin (All butonu). Koordinat sistemi çok büyük olabilir — Home ile fit yapın.</td></tr>
  <tr><td>Metin bozuk görünüyor</td><td>SHX fontları tam desteklenmez; ASCII dışı karakterler <code>?</code> olarak gösterilir. DXF dosyasını başka bir programda Segoe UI veya Arial'a dönüştürün.</td></tr>
  <tr><td>FPS düşük / Low FPS</td><td>50.000+ entity için normaldir. TEXT render'ı bu eşiğin üstünde otomatik devre dışı kalır. GPU sürücülerinizi güncelleyin.</td></tr>
  <tr><td>OSNAP çalışmıyor</td><td>Statusbar'daki OSNAP butonunun yeşil yandığını kontrol edin. Pan/zoom modunda OSNAP göstergesi çalışmaz.</td></tr>
  <tr><td>PDF baskısı boş</td><td>Tarayıcı print dialog'unda "Arka plan grafikleri" / "Background graphics" seçeneğini aktifleştirin.</td></tr>
</table>

<div class="hc-lang-block">
  <div class="hc-lang-tr">
    <h3 class="hc-sub">Debug Günlüğü</h3>
    <p>DWG dönüşüm sorunları için <code>%TEMP%\cadze_debug.log</code> dosyasını inceleyin. Her dönüşüm adımı buraya kaydedilir.</p>
    <h3 class="hc-sub">Sorun Bildirme</h3>
    <p><strong>Help → Report Issue</strong> ile GitHub Issues sayfasına gidin. Lütfen debug günlüğünü ve kullandığınız DWG sürümünü ekleyin.</p>
  </div>
  <div class="hc-lang-en">
    <h3 class="hc-sub">Debug Log</h3>
    <p>For DWG conversion issues, check <code>%TEMP%\\cadze_debug.log</code>. Every conversion step is logged there.</p>
    <h3 class="hc-sub">Reporting Issues</h3>
    <p>Use <strong>Help → Report Issue</strong> to open GitHub Issues. Please include the debug log and the DWG version.</p>
  </div>
</div>

<div class="hc-footer">
  <div>⬡ CADZE v0.2 — Free &amp; Open Source CAD Viewer</div>
  <div>github.com/sedattelli/cadze &nbsp;·&nbsp; DXF · DWG · STL · Windows</div>
  <div style="margin-top:6px;font-size:10px;opacity:0.5">Tüm işlemler yerel / All processing is local · Hiçbir veri buluta gönderilmez / No data sent to cloud</div>
</div>
`;
