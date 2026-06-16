using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NagStudy.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskColor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Color",
                table: "Tasks",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Color",
                table: "Tasks");
        }
    }
}
