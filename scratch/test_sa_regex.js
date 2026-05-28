const block = `
class User(Base):
    __tablename__ = "User"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    branch: Mapped[List["Branch"]] = relationship(secondary="Branch_User", back_populates="user")
    address: Mapped[List["Address"]] = relationship(back_populates="user_list")
`;
const relRegex = /Mapped\[(?:List\[)?['"]?(\w+)['"]?\]?\]?\s*=\s*relationship\s*\([^)]*secondary\s*=\s*['"]([^'"]+)['"][^)]*\)/g;
let m;
while ((m = relRegex.exec(block)) !== null) {
  console.log('M2M target:', m[1], 'secondary:', m[2]);
}
