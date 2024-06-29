# Herald

Bot na slacka ktory publikuje informacje o kontach które zostały dopiero aktywowane i które zostały zdezaktywowane.

Zainspirowany https://rachelbythebay.com/w/2024/02/08/ldap/

Przygotowany do uruchomienia na fly.io. Przystosowany do działania w oparciu o wiele workspace'ów jednocześnie.

Ogłoszenia umieszczane przez bota nie wysyłają powiadomień do mentionowanych osób. Pozwala to w dość elegancki sposób przedstawić nowego pracownika innym, bez powiadamiania go o tym i stresowania w pierwszym dniu pracy. Osoby które odeszły też są mentionowane dopiero po deaktywacji konta, więc siłą rzeczy nie mogą się odnieść do komentarzy.

Bot jest obecnie używany w postaci oddolnej mojej inicjatywy w workspace Unity Group.

## FSM

Do działania bota potrzebna jest informacja o tym, że ktoś został zatrudniony lub zwolniony.
Niestety nie posiadamy takiej informacji. Posiadamy aktualną liste użytkowników, wraz z flagą
która mówi nam że dane konto jest zdezaktywowane. 

To czy ktoś jest zwolniony czy zatrudniony, jest efektem procesu który jest dla nas niewidoczny,
ale możemy go odtworzyć obserwując aktualny stan i aktualną liste użytkowników.

Mapowanie użytkowników odbywa się w bazie danych PostgreSQL. W relacji o nazwie `user_states`
przechowywane sa nast. dane:
- `slackId` - id użytkownika Slack, np. UABCDEFG
- `slackTeamId` - id organizacji Slack
- `currentState` - stan w maszynie stanów
- `lastStateChange` - timestamp ostatniej zmiany stanu
- `lastAnnouncement` - timestamp ostatniego ogloszenia o przywitaniu/pozegnaniu

Maszyna stanów przyjmuje nastepujące stany oraz warunki tranzycji:

                 ┌──────────┐              
                 │          │              
         ┌───────┤   init   │              
         │       │          │              
         │       └──────────┘              
         │                                 
         │                                 
         │ seen without                    
         │ blocked state                   
         │                                 
         │                                 
         │                                 
         ▼        seen with                
    ┌──────────┐ ─────────────►┌──────────┐
    │          │ blocked state │          │
    │  active  │               │ inactive │
    │          │  seen without │          │
    └──────────┘◄───────────── └──────────┘
                 blocked state             

W szczególności należy zwrócić uwage na brak tranzycji dla nowego użytkownika który jest od razu zablokowany.
Świadomie ich ignorujemy.

Dodatkowo, jeden użytkownik może wielokrotnie przechodzić pomiędzy stanami active i inactive, pozwalając na
przywitania i pożegnania wiele razy jeśli postanowi się zatrudnić i zwalniać ;].
