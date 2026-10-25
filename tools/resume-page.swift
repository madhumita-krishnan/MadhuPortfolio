// The resume sheet's page (resume-plane.js): renders page 1 of assets/resume.pdf sharp enough for a 3x phone and pinch
// zoom, and lists its links so the sheet can lay clickable areas over the picture (a JPG of a PDF has no links; someone
// opening it from the site found it blurry and dead). Rerun whenever resume.pdf changes; build.js warns if you forget.
//   swift tools/resume-page.swift
import PDFKit
import AppKit
import CryptoKit

let pdfURL = URL(fileURLWithPath: "assets/resume.pdf")
let data = try! Data(contentsOf: pdfURL)
let doc = PDFDocument(data: data)!, page = doc.page(at: 0)!   // keep doc alive: PDFKit won't draw an orphaned page
let box = page.bounds(for: .mediaBox)
let W = 2000.0, s = W / box.width, H = (box.height * s).rounded()

let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(W), pixelsHigh: Int(H), bitsPerSample: 8, samplesPerPixel: 4,
                           hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
let ctx = NSGraphicsContext(bitmapImageRep: rep)!.cgContext
ctx.setFillColor(.white); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
ctx.scaleBy(x: s, y: s)
page.draw(with: .mediaBox, to: ctx)
try! rep.representation(using: .jpeg, properties: [.compressionFactor: 0.7])!.write(to: URL(fileURLWithPath: "assets/resume-page.jpg"))

// link rects as fractions of the page, top-left origin
var links: [[String: Any]] = []
for a in page.annotations where a.type == "Link" {
  guard let u = a.url ?? (a.action as? PDFActionURL)?.url else { continue }
  let r = a.bounds
  links.append(["url": u.absoluteString,
                "x": (r.minX - box.minX) / box.width, "y": (box.maxY - r.maxY) / box.height,
                "w": r.width / box.width, "h": r.height / box.height])
}
let sha = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
let json = try! JSONSerialization.data(withJSONObject: ["pdf": sha, "links": links], options: [.prettyPrinted, .sortedKeys])
try! json.write(to: URL(fileURLWithPath: "assets/resume-page.json"))
print("resume-page.jpg \(Int(W))x\(Int(H)), \(links.count) links")
