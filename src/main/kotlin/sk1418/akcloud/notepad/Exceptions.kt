package sk1418.akcloud.notepad

open class NotepadException(val msg: String) : RuntimeException(msg)

class NoteKeyExistsException(key: String) : NotepadException("The note with key '$key' already exists.")
class NoteNotFoundException(key: String) : NotepadException("The note with key '$key' doesn't exist.")
class InvalidPasswordException(key: String) : NotepadException("Invalid password for note '$key'.")