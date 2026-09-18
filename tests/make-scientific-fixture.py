from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont('Scientific','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
c=canvas.Canvas('tests/fixtures/scientific.pdf',pagesize=(600,800))
c.setFont('Scientific',18);c.drawString(50,760,'Scientific reading order and glyph verification')
for i in range(6):
 for x,label in [(330,'RIGHT'),(50,'LEFT')]:
  c.setFont('Scientific',12);c.drawString(x,700-i*24,f'{label} column sentence {i+1}.')
c.showPage();c.setFont('Scientific',18);c.drawString(50,760,'Scientific notation: preserve meaning')
base='Concentration: 10';c.setFont('Scientific',12);c.drawString(50,700,base)
x=50+pdfmetrics.stringWidth(base,'Scientific',12);c.setFont('Scientific',8);c.drawString(x,705,'−14')
c.setFont('Scientific',12);c.drawString(50,650,'H');x=50+pdfmetrics.stringWidth('H','Scientific',12)
c.setFont('Scientific',8);c.drawString(x,647,'2');x+=pdfmetrics.stringWidth('2','Scientific',8)
c.setFont('Scientific',12);c.drawString(x,650,'O')
c.drawString(50,600,'Δλ = 980 nm; α β μ µ Ω ± × ≤ ≥ ∞')
c.drawString(50,550,'Already encoded: x² + H₂O; 10⁻¹⁴')
c.drawString(50,500,'Negative baseline: −14; range 10–20; 50%')
c.save()
