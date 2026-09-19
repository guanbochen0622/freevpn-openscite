from PIL import Image,ImageDraw,ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
im=Image.new('RGB',(1200,1600),'white');d=ImageDraw.Draw(im)
f=lambda size:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',size)
d.text((100,110),'SCANNED RESEARCH PAGE',font=f(42),fill='black')
for y,text in [(240,'Measured wavelength is 980 nm.'),(330,'The sensor response was recorded.'),(430,'Concentration: 10'),(630,'Sample        Wavelength (nm)'),(710,'Control        980'),(780,'Treatment      985')]:d.text((100,y),text,font=f(32),fill='black')
x=100+d.textlength('Concentration: 10',font=f(32));d.text((x,420),'−14',font=f(23),fill='black')
d.text((100,530),'H',font=f(32),fill='black');d.text((125,546),'2',font=f(23),fill='black');d.text((140,530),'O',font=f(32),fill='black')
c=canvas.Canvas('tests/fixtures/scanned.pdf',pagesize=(600,800));c.drawImage(ImageReader(im),0,0,width=600,height=800);c.save()
im.save('/tmp/openscite-scanned-fixture.png')
