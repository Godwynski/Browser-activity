$word = New-Object -ComObject Word.Application
$word.Visible = $false
$docPath = "C:\Users\Godwyn\Downloads\aws\05_Laboratory_Exercise_1_Godwyn_Neri_BSIT711.docx"
$pdfPath = "C:\Users\Godwyn\Downloads\aws\05_Laboratory_Exercise_1_Godwyn_Neri_BSIT711.pdf"
$coursePdf = "C:\Users\Godwyn\Documents\Projects\Browser activity\courses\Network_Technology_2\assignments\midterm\05_Laboratory_Exercise_1\05_Laboratory_Exercise_1_Godwyn_Neri_BSIT711.pdf"

$doc = $word.Documents.Open($docPath)
$doc.SaveAs([ref]$pdfPath, [ref]17)
$doc.Close()
$word.Quit()
Copy-Item $pdfPath $coursePdf -Force
Write-Output "PDF converted: $pdfPath"
