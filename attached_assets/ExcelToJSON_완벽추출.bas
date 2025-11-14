Attribute VB_Name = "ExcelToJSON"
Option Explicit

' ============================================================
' 엑셀 셀 서식을 완벽하게 JSON으로 추출하는 VBA 매크로
' 사용법: 엑셀에서 Alt+F11 → 모듈 추가 → 이 코드 붙여넣기 → F5로 ExportToJSONFile 실행
' ============================================================

Function ExportCellFormattingToJSON(rng As Range) As String
    ' 셀 서식 데이터를 JSON 형식으로 추출
    ' 포함: 좌표, 색상, 폰트, 테두리, 정렬, 병합 정보
    
    Dim cell As Range
    Dim jsonParts() As String
    ReDim jsonParts(rng.Cells.Count - 1)
    Dim i As Long
    i = 0
    
    For Each cell In rng
        jsonParts(i) = CellToJSON(cell)
        i = i + 1
    Next cell
    
    ' 배열로 감싸기
    ExportCellFormattingToJSON = "[" & vbCrLf & Join(jsonParts, "," & vbCrLf) & vbCrLf & "]"
End Function

Function CellToJSON(cell As Range) As String
    Dim json As String
    Dim dq As String
    dq = """"
    
    json = "  {" & vbCrLf
    
    ' 셀 주소
    json = json & "    " & dq & "cell" & dq & ": " & dq & Replace(cell.Address, "$", "") & dq & "," & vbCrLf
    
    ' 값
    Dim cellValue As String
    cellValue = ""
    If Not IsEmpty(cell.Value) Then
        cellValue = CStr(cell.Value)
    End If
    json = json & "    " & dq & "value" & dq & ": " & dq & EscapeJSON(cellValue) & dq & "," & vbCrLf
    
    ' 폰트 이름
    json = json & "    " & dq & "font_name" & dq & ": " & dq & cell.Font.Name & dq & "," & vbCrLf
    
    ' 폰트 크기
    json = json & "    " & dq & "font_size" & dq & ": " & dq & cell.Font.Size & dq & "," & vbCrLf
    
    ' 볼드
    json = json & "    " & dq & "bold" & dq & ": " & dq & CStr(cell.Font.Bold) & dq & "," & vbCrLf
    
    ' 이탤릭
    json = json & "    " & dq & "italic" & dq & ": " & dq & CStr(cell.Font.Italic) & dq & "," & vbCrLf
    
    ' 폰트 색상
    json = json & "    " & dq & "font_color" & dq & ": " & dq & GetColorHex(cell.Font.Color) & dq & "," & vbCrLf
    
    ' 배경색
    json = json & "    " & dq & "fill_color" & dq & ": " & dq & GetColorHex(cell.Interior.Color) & dq & "," & vbCrLf
    
    ' 가로 정렬
    json = json & "    " & dq & "alignment_horizontal" & dq & ": " & dq & GetAlignmentH(cell.HorizontalAlignment) & dq & "," & vbCrLf
    
    ' 세로 정렬
    json = json & "    " & dq & "alignment_vertical" & dq & ": " & dq & GetAlignmentV(cell.VerticalAlignment) & dq & "," & vbCrLf
    
    ' 병합 정보
    Dim mergeRange As String
    mergeRange = "None"
    If cell.MergeCells Then
        mergeRange = Replace(cell.MergeArea.Address, "$", "")
    End If
    json = json & "    " & dq & "merge_range" & dq & ": " & dq & mergeRange & dq & "," & vbCrLf
    
    ' 테두리
    json = json & "    " & dq & "border" & dq & ": {" & vbCrLf
    json = json & "      " & dq & "top" & dq & ": " & dq & GetBorderStyle(cell.Borders(xlEdgeTop).LineStyle) & dq & "," & vbCrLf
    json = json & "      " & dq & "bottom" & dq & ": " & dq & GetBorderStyle(cell.Borders(xlEdgeBottom).LineStyle) & dq & "," & vbCrLf
    json = json & "      " & dq & "left" & dq & ": " & dq & GetBorderStyle(cell.Borders(xlEdgeLeft).LineStyle) & dq & "," & vbCrLf
    json = json & "      " & dq & "right" & dq & ": " & dq & GetBorderStyle(cell.Borders(xlEdgeRight).LineStyle) & dq & vbCrLf
    json = json & "    }" & vbCrLf
    
    json = json & "  }"
    
    CellToJSON = json
End Function

Function GetColorHex(color As Long) As String
    ' Excel 색상(Long)을 Hex 문자열로 변환 (AARRGGBB 형식)
    On Error Resume Next
    
    If color = -4142 Or color = 16777215 Then ' 자동/흰색
        GetColorHex = "00000000"
    Else
        Dim r As Long, g As Long, b As Long
        r = color Mod 256
        g = (color \ 256) Mod 256
        b = (color \ 65536) Mod 256
        
        ' ARGB 형식으로 반환 (FF = 불투명)
        GetColorHex = "FF" & _
            Right("0" & Hex(r), 2) & _
            Right("0" & Hex(g), 2) & _
            Right("0" & Hex(b), 2)
    End If
End Function

Function GetBorderStyle(style As Long) As String
    ' 테두리 스타일 변환
    Select Case style
        Case xlContinuous
            GetBorderStyle = "thin"
        Case xlThick
            GetBorderStyle = "medium"
        Case xlDouble
            GetBorderStyle = "double"
        Case xlDash
            GetBorderStyle = "dashed"
        Case xlDot
            GetBorderStyle = "dotted"
        Case xlNone, xlLineStyleNone, -4142
            GetBorderStyle = "None"
        Case Else
            GetBorderStyle = "None"
    End Select
End Function

Function GetAlignmentH(align As Long) As String
    ' 가로 정렬 변환
    Select Case align
        Case xlLeft, -4131
            GetAlignmentH = "left"
        Case xlCenter, -4108
            GetAlignmentH = "center"
        Case xlRight, -4152
            GetAlignmentH = "right"
        Case Else
            GetAlignmentH = "None"
    End Select
End Function

Function GetAlignmentV(align As Long) As String
    ' 세로 정렬 변환
    Select Case align
        Case xlTop, -4160
            GetAlignmentV = "top"
        Case xlCenter, -4108
            GetAlignmentV = "center"
        Case xlBottom, -4107
            GetAlignmentV = "bottom"
        Case Else
            GetAlignmentV = "None"
    End Select
End Function

Function EscapeJSON(s As String) As String
    ' JSON 특수문자 이스케이프
    s = Replace(s, "\", "\\")
    s = Replace(s, """", "\""")
    s = Replace(s, vbCr, "")
    s = Replace(s, vbLf, "\n")
    s = Replace(s, vbTab, "\t")
    EscapeJSON = s
End Function

Sub ExportToJSONFile()
    ' ============================================================
    ' 메인 실행 함수: 선택한 범위를 JSON 파일로 저장
    ' ============================================================
    
    Dim json As String
    Dim filePath As String
    Dim selectedRange As Range
    
    ' 사용자가 범위를 선택했는지 확인
    On Error Resume Next
    Set selectedRange = Selection
    On Error GoTo 0
    
    If selectedRange Is Nothing Then
        MsgBox "셀 범위를 선택한 후 실행하세요.", vbExclamation
        Exit Sub
    End If
    
    ' 선택한 범위 추출
    json = ExportCellFormattingToJSON(selectedRange)
    
    ' 파일 저장 대화상자
    Dim fileName As Variant
    fileName = Application.GetSaveAsFilename( _
        InitialFileName:="양식_서식코드.json", _
        FileFilter:="JSON Files (*.json), *.json", _
        Title:="JSON 파일로 저장")
    
    If fileName = False Then
        MsgBox "저장이 취소되었습니다.", vbInformation
        Exit Sub
    End If
    
    filePath = CStr(fileName)
    
    ' 파일 저장
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    
    Dim fileStream As Object
    Set fileStream = fso.CreateTextFile(filePath, True, True) ' UTF-8
    fileStream.Write json
    fileStream.Close
    
    MsgBox "JSON 파일이 저장되었습니다!" & vbCrLf & vbCrLf & filePath, vbInformation
End Sub

Sub ExportCurrentSheetToJSON()
    ' ============================================================
    ' 현재 시트 전체를 JSON으로 저장
    ' ============================================================
    
    Dim json As String
    Dim filePath As String
    
    ' 사용 중인 범위 전체 추출
    json = ExportCellFormattingToJSON(ActiveSheet.UsedRange)
    
    ' 파일 저장 대화상자
    Dim fileName As Variant
    fileName = Application.GetSaveAsFilename( _
        InitialFileName:="양식_서식코드.json", _
        FileFilter:="JSON Files (*.json), *.json", _
        Title:="JSON 파일로 저장")
    
    If fileName = False Then
        MsgBox "저장이 취소되었습니다.", vbInformation
        Exit Sub
    End If
    
    filePath = CStr(fileName)
    
    ' 파일 저장
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    
    Dim fileStream As Object
    Set fileStream = fso.CreateTextFile(filePath, True, True)
    fileStream.Write json
    fileStream.Close
    
    MsgBox "JSON 파일이 저장되었습니다!" & vbCrLf & vbCrLf & filePath, vbInformation
End Sub
